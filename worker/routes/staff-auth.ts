import { Hono } from 'hono';
import * as v from 'valibot';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  credentialIdSchema,
  credentialRenameSchema,
  linkSchema,
  loginVerifySchema,
  registerOptionsSchema,
  registerVerifySchema,
  sessionRevokeSchema,
} from '../../shared/staff-schemas.ts';
import { newId } from '../ids.ts';
import { clearedSessionCookie, readStaffSession, SESSION_SECONDS, sessionCookie } from '../middleware/staff-session.ts';
import type { AppEnv } from '../middleware/tenant.ts';
import { allow } from '../ratelimit.ts';
import { audit, challenges, credentials, people, sessions, tokens } from '../repositories/index.ts';
import { randomToken, sha256Hex } from '../security.ts';

const CHALLENGE_SECONDS = 5 * 60;
const WINDOW = 15 * 60;
const RP_NAME = 'Hostel companion';

interface Config {
  rpID: string;
  origins: string[];
}
function config(env: Env): Config | null {
  const rpID = env.RP_ID?.trim();
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return rpID && origins.length > 0 ? { rpID, origins } : null;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** Staff sign-in, sessions, passkeys and links (D-26, D-28). Person-level: no property in the path. */
export function createStaffAuthRoutes(now: () => number): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  // Everything below answers 503 until RP_ID and ALLOWED_ORIGINS are set for this environment.
  r.use('*', async (c, next) => (config(c.env) ? next() : c.json({ error: 'not_configured' }, 503)));

  const limited = async (c: { env: Env; req: { raw: Request } }, endpoint: string, limit: number) =>
    !(await allow(c.env, c.req.raw, endpoint, limit, WINDOW, now()));

  // ---- sign in with a discoverable passkey: no username is typed ----
  r.post('/login/options', async (c) => {
    if (await limited(c, 'login', 40)) return c.json({ error: 'rate_limited' }, 429);
    const cfg = config(c.env) as Config;
    const options = await generateAuthenticationOptions({ rpID: cfg.rpID, userVerification: 'required' });
    const challengeId = newId();
    await challenges.create(c.env.DB, { id: challengeId, challenge: options.challenge, purpose: 'login', staffUserId: null, tokenHash: null }, now(), CHALLENGE_SECONDS);
    return c.json({ challengeId, options });
  });

  r.post('/login/verify', async (c) => {
    if (await limited(c, 'login', 40)) return c.json({ error: 'rate_limited' }, 429);
    const cfg = config(c.env) as Config;
    const fail = () => c.json({ error: 'sign_in_failed' }, 401); // one answer, whatever the reason
    const body = v.safeParse(loginVerifySchema, await c.req.json().catch(() => null));
    if (!body.success) return fail();
    const ch = await challenges.consume(c.env.DB, body.output.challengeId, 'login', now());
    if (!ch) return fail();
    const response = body.output.response as unknown as AuthenticationResponseJSON;
    const cred = await credentials.findActive(c.env.DB, String(response.id));
    if (!cred) return fail();
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpID,
        requireUserVerification: true,
        credential: {
          id: cred.id,
          publicKey: cred.publicKey as Uint8Array<ArrayBuffer>,
          counter: cred.counter,
          transports: cred.transports ? (cred.transports.split(',') as never) : undefined,
        },
      });
    } catch {
      return fail();
    }
    if (!result.verified) return fail();
    await credentials.recordUse(c.env.DB, cred.id, result.authenticationInfo.newCounter, now());
    const token = randomToken();
    await sessions.create(c.env.DB, await sha256Hex(token), cred.staffUserId, now(), SESSION_SECONDS);
    await audit.appendForPerson(c.env.DB, cred.staffUserId, { action: 'staff.signin', targetType: 'staff', targetId: cred.staffUserId }, now());
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
  });

  // ---- what a link is for (the page shows it before anything is created) ----
  r.post('/link/inspect', async (c) => {
    if (await limited(c, 'link', 30)) return c.json({ error: 'rate_limited' }, 429);
    const body = v.safeParse(linkSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_link' }, 400);
    const t = await tokens.inspect(c.env.DB, await sha256Hex(body.output.token), now());
    if (!t) return c.json({ error: 'invalid_link' }, 400);
    const existing = t.purpose === 'invite' ? await people.findUserByEmail(c.env.DB, t.email) : null;
    return c.json({ purpose: t.purpose, displayName: t.displayName, existingUser: existing !== null && !existing.disabled });
  });

  // ---- registering a passkey: by invite, by recovery link, or while signed in ----
  r.post('/register/options', async (c) => {
    const cfg = config(c.env) as Config;
    const body = v.safeParse(registerOptionsSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    let staffUserId: string;
    let userName: string;
    let displayName: string;
    let tokenHash: string | null = null;
    let exclude: { id: string }[] = [];

    if (body.output.token) {
      if (await limited(c, 'link', 30)) return c.json({ error: 'rate_limited' }, 429);
      tokenHash = await sha256Hex(body.output.token);
      const t = await tokens.inspect(c.env.DB, tokenHash, now());
      if (!t) return c.json({ error: 'invalid_link' }, 400);
      if (t.purpose === 'invite') {
        // An invite never lets someone register a passkey on an account that already exists: that person
        // signs in and accepts the invite instead. Otherwise an invite would be an account takeover.
        if (await people.findUserByEmail(c.env.DB, t.email)) return c.json({ error: 'existing_user' }, 409);
        staffUserId = newId();
      } else {
        staffUserId = t.staffUserId as string;
      }
      userName = t.email;
      displayName = t.displayName || t.email;
    } else {
      const s = await readStaffSession(c.env.DB, c.req.raw, now());
      if (!s) return c.json({ error: 'unauthorized' }, 401);
      const u = await people.findUserById(c.env.DB, s.staffUserId);
      if (!u) return c.json({ error: 'unauthorized' }, 401);
      staffUserId = u.id;
      userName = u.email;
      displayName = u.displayName || u.email;
      exclude = (await credentials.listFor(c.env.DB, u.id)).map((x) => ({ id: x.id }));
    }
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: cfg.rpID,
      userName,
      userDisplayName: displayName,
      userID: new TextEncoder().encode(staffUserId),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: exclude,
    });
    const challengeId = newId();
    await challenges.create(c.env.DB, { id: challengeId, challenge: options.challenge, purpose: 'register', staffUserId, tokenHash }, now(), CHALLENGE_SECONDS);
    return c.json({ challengeId, options });
  });

  r.post('/register/verify', async (c) => {
    const cfg = config(c.env) as Config;
    const body = v.safeParse(registerVerifySchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    const db = c.env.DB;
    const ch = await challenges.consume(db, body.output.challengeId, 'register', now());
    if (!ch || !ch.staffUserId) return c.json({ error: 'invalid_challenge' }, 400);
    if (ch.tokenHash && (await limited(c, 'link', 30))) return c.json({ error: 'rate_limited' }, 429);
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response: body.output.response as unknown as RegistrationResponseJSON,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpID,
        requireUserVerification: true,
      });
    } catch {
      return c.json({ error: 'verification_failed' }, 400);
    }
    if (!verified.verified) return c.json({ error: 'verification_failed' }, 400);
    const cred = verified.registrationInfo.credential;
    const label = body.output.label ?? '';
    const record = { id: cred.id, staffUserId: ch.staffUserId, publicKey: cred.publicKey, counter: cred.counter, transports: (cred.transports ?? []).join(','), label };

    if (ch.tokenHash) {
      // The link is used exactly once, here, after the ceremony has verified.
      const t = await tokens.consume(db, ch.tokenHash, now());
      if (!t) return c.json({ error: 'invalid_link' }, 400);
      if (t.purpose === 'invite') {
        if (await people.findUserByEmail(db, t.email)) return c.json({ error: 'existing_user' }, 409);
        await people.createUser(db, { id: ch.staffUserId, email: t.email, displayName: t.displayName }, now());
        await people.addMembership(db, ch.staffUserId, t.propertyId as string, t.role as 'editor' | 'admin');
        await credentials.insert(db, record, now());
        await audit.appendForPerson(db, ch.staffUserId, { action: 'staff.invite.accepted', targetType: 'staff', targetId: ch.staffUserId }, now());
      } else {
        // Recovery replaces access: every earlier session and passkey stops working at once.
        await sessions.revokeAllFor(db, ch.staffUserId, now());
        await credentials.revokeAllFor(db, ch.staffUserId, now());
        await credentials.insert(db, record, now());
        await audit.appendForPerson(db, ch.staffUserId, { action: 'staff.recovery.completed', targetType: 'staff', targetId: ch.staffUserId }, now());
      }
      const token = randomToken();
      await sessions.create(db, await sha256Hex(token), ch.staffUserId, now(), SESSION_SECONDS);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
    }

    const s = await readStaffSession(db, c.req.raw, now());
    if (!s || s.staffUserId !== ch.staffUserId) return c.json({ error: 'unauthorized' }, 401);
    await credentials.insert(db, record, now());
    await audit.appendForPerson(db, s.staffUserId, { action: 'staff.passkey.added', targetType: 'staff', targetId: s.staffUserId }, now());
    return c.json({ ok: true });
  });

  // ---- an existing person accepts an invite to another property ----
  r.post('/link/accept', async (c) => {
    if (await limited(c, 'link', 30)) return c.json({ error: 'rate_limited' }, 429);
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const body = v.safeParse(linkSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_link' }, 400);
    const hash = await sha256Hex(body.output.token);
    const peek = await tokens.inspect(c.env.DB, hash, now());
    const me = await people.findUserById(c.env.DB, s.staffUserId);
    // The invite is for one email address: only that person, signed in, can take it.
    if (!peek || peek.purpose !== 'invite' || !me || me.email !== peek.email) return c.json({ error: 'invalid_link' }, 400);
    const t = await tokens.consume(c.env.DB, hash, now());
    if (!t) return c.json({ error: 'invalid_link' }, 400);
    await people.addMembership(c.env.DB, s.staffUserId, t.propertyId as string, t.role as 'editor' | 'admin');
    await audit.appendForPerson(c.env.DB, s.staffUserId, { action: 'staff.invite.accepted', targetType: 'staff', targetId: s.staffUserId }, now());
    const slug = (await people.membershipsOf(c.env.DB, s.staffUserId)).find((m) => m.propertyId === t.propertyId)?.slug ?? null;
    return c.json({ ok: true, slug });
  });

  // ---- the signed-in person ----
  r.get('/me', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const u = await people.findUserById(c.env.DB, s.staffUserId);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const memberships = await people.membershipsOf(c.env.DB, u.id);
    return c.json({
      displayName: u.displayName,
      email: u.email,
      passkeys: await credentials.countActive(c.env.DB, u.id),
      properties: memberships.map((m) => ({ slug: m.slug, name: { en: m.nameEn, fr: m.nameFr }, role: m.role })),
    });
  });

  r.post('/logout', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (s) {
      await sessions.revokeOne(c.env.DB, s.sessionId, now());
      await audit.appendForPerson(c.env.DB, s.staffUserId, { action: 'staff.signout', targetType: 'staff', targetId: s.staffUserId }, now());
    }
    return json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie });
  });

  r.post('/logout-all', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    await sessions.revokeAllFor(c.env.DB, s.staffUserId, now());
    await audit.appendForPerson(c.env.DB, s.staffUserId, { action: 'staff.signout_all', targetType: 'staff', targetId: s.staffUserId }, now());
    return json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie });
  });

  r.get('/sessions', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await sessions.listFor(c.env.DB, s.staffUserId, s.sessionId, now()));
  });

  r.post('/sessions/revoke', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const body = v.safeParse(sessionRevokeSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    const n = await sessions.revokeByHandle(c.env.DB, s.staffUserId, body.output.handle, now());
    if (n > 0) await audit.appendForPerson(c.env.DB, s.staffUserId, { action: 'staff.session.revoked', targetType: 'staff', targetId: s.staffUserId }, now());
    return c.json({ revoked: n });
  });

  r.get('/credentials', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await credentials.listFor(c.env.DB, s.staffUserId));
  });

  r.post('/credentials/revoke', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const body = v.safeParse(credentialIdSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    const result = await credentials.revoke(c.env.DB, s.staffUserId, body.output.id, now());
    if (result === 'last') return c.json({ error: 'last_credential' }, 409);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    await audit.appendForPerson(c.env.DB, s.staffUserId, { action: 'staff.passkey.revoked', targetType: 'staff', targetId: s.staffUserId }, now());
    return c.json({ revoked: 1 });
  });

  r.post('/credentials/rename', async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const body = v.safeParse(credentialRenameSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    const ok = await credentials.rename(c.env.DB, s.staffUserId, body.output.id, body.output.label);
    return ok ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
  });

  return r;
}
