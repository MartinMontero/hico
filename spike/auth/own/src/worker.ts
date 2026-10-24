// SPIKE (Phase 1b-1, Route 3): our own WebAuthn with D1 sessions. Throwaway; never imported by worker/.
// It reuses the repository's tenant layer (staffTenant, roleAtSlug, audit.append) on purpose, to show
// how a sign-in route plugs into the StaffResolver seam. Raw SQL is used here for speed; in the real
// build it would live in worker/repositories.
import { Hono } from 'hono';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { newId } from '../../../../worker/ids.ts';
import { writeGuards } from '../../../../worker/middleware/guards.ts';
import { requestLog, securityHeaders } from '../../../../worker/middleware/headers.ts';
import { staffTenant } from '../../../../worker/middleware/tenant.ts';
import { audit, staff } from '../../../../worker/repositories/index.ts';
import { createTenantContext } from '../../../../worker/tenant.ts';

interface SpikeEnv extends Env {
  ORIGIN: string;
  RP_ID: string;
  SESSION_PEPPER: string;
  SPIKE_TEST?: string;
}
type C = { env: SpikeEnv; req: { raw: Request; header: (n: string) => string | undefined; json: () => Promise<unknown> } };

const COOKIE = 'spike_staff';
const SESSION_SECONDS = 12 * 3600;
const TOKEN_SECONDS = 30 * 60;
const CHALLENGE_SECONDS = 5 * 60;
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const randomToken = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));
async function hmacHex(pepper: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}
function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
const cookieHeader = (token: string, maxAge: number) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const emailOk = (e: unknown): e is string => typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const bytes = (v: unknown): Uint8Array => new Uint8Array(v as ArrayBuffer | number[]);

/** Person-level events have no single property; audit_log is per property, so write one row per membership. */
async function auditPerson(db: D1Database, staffUserId: string, action: string, targetType = 'staff', targetId: string | null = null): Promise<void> {
  const { results } = await db
    .prepare('SELECT m.property_id, p.slug, p.timezone FROM staff_memberships m JOIN properties p ON p.id = m.property_id WHERE m.staff_user_id = ?1')
    .bind(staffUserId)
    .all<{ property_id: string; slug: string; timezone: string }>();
  for (const m of results) {
    await audit.append(
      createTenantContext(db, { propertyId: m.property_id, slug: m.slug, timezone: m.timezone }),
      { actorKind: 'staff', actorStaffId: staffUserId, action, targetType, targetId: targetId ?? staffUserId },
      now(),
    );
  }
}

async function sessionUser(c: C): Promise<{ staffUserId: string; sessionId: string } | null> {
  const token = readCookie(c.req.header('Cookie'), COOKIE);
  if (!token) return null;
  const id = await hmacHex(c.env.SESSION_PEPPER, token);
  const row = await c.env.DB.prepare(
    `SELECT s.staff_user_id FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id
     WHERE s.id = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.disabled_at IS NULL`,
  )
    .bind(id, now())
    .first<{ staff_user_id: string }>();
  return row ? { staffUserId: row.staff_user_id, sessionId: id } : null;
}

async function startSession(env: SpikeEnv, staffUserId: string): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO staff_sessions (id, staff_user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await hmacHex(env.SESSION_PEPPER, token), staffUserId, now(), now() + SESSION_SECONDS)
    .run();
  return token;
}

async function capture(db: D1Database, to: string, subject: string, body: string): Promise<void> {
  await db.prepare('INSERT INTO email_capture (to_email, subject, body, created_at) VALUES (?1, ?2, ?3, ?4)').bind(to, subject, body, now()).run();
}

export function createSpikeApp(): Hono<{ Bindings: SpikeEnv }> {
  const app = new Hono<{ Bindings: SpikeEnv }>();
  app.use('*', requestLog);
  app.use('*', securityHeaders);
  app.use('/auth/*', writeGuards);

  // ---- invites and recovery (tokens are hashed, single use, 30 minutes) ----
  app.post('/auth/invite', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as { slug?: string; email?: string; role?: string } | null;
    if (!body || !emailOk(body.email) || typeof body.slug !== 'string' || (body.role !== 'editor' && body.role !== 'admin')) return c.json({ error: 'bad_request' }, 400);
    const access = await staff.roleAtSlug(c.env.DB, who.staffUserId, body.slug);
    if (!access || access.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const token = randomToken();
    await c.env.DB.prepare(
      `INSERT INTO staff_tokens (token_hash, purpose, email, property_id, role, created_by, created_at, expires_at)
       VALUES (?1, 'invite', ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
      .bind(await hmacHex(c.env.SESSION_PEPPER, token), body.email.toLowerCase(), access.propertyId, body.role, who.staffUserId, now(), now() + TOKEN_SECONDS)
      .run();
    await capture(c.env.DB, body.email, 'You are invited', `${c.env.ORIGIN}/#invite=${token}`);
    await audit.append(createTenantContext(c.env.DB, access), { actorKind: 'staff', actorStaffId: who.staffUserId, action: 'staff.invite.created', targetType: 'invite', targetId: null }, now());
    return c.json({ ok: true });
  });

  app.post('/auth/recover', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
    // Same answer whether or not the address is known (no account enumeration).
    if (body && emailOk(body.email)) {
      const user = await c.env.DB.prepare('SELECT id FROM staff_users WHERE email = ?1 AND disabled_at IS NULL').bind(body.email.toLowerCase()).first<{ id: string }>();
      if (user) {
        const token = randomToken();
        await c.env.DB.prepare(`INSERT INTO staff_tokens (token_hash, purpose, email, created_at, expires_at) VALUES (?1, 'recovery', ?2, ?3, ?4)`)
          .bind(await hmacHex(c.env.SESSION_PEPPER, token), body.email.toLowerCase(), now(), now() + TOKEN_SECONDS)
          .run();
        await capture(c.env.DB, body.email, 'Recover your access', `${c.env.ORIGIN}/#recover=${token}`);
        await auditPerson(c.env.DB, user.id, 'staff.recovery.requested');
      }
    }
    return c.json({ ok: true });
  });

  // ---- registration: invite, recovery, or "add another passkey" while signed in ----
  app.post('/auth/register/options', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string };
    let staffUserId: string;
    let email: string;
    let tokenHash: string | null = null;
    if (typeof body.token === 'string') {
      tokenHash = await hmacHex(c.env.SESSION_PEPPER, body.token);
      const t = await c.env.DB.prepare('SELECT purpose, email FROM staff_tokens WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2').bind(tokenHash, now()).first<{ purpose: string; email: string }>();
      if (!t) return c.json({ error: 'invalid_token' }, 400);
      email = t.email;
      const existing = await c.env.DB.prepare('SELECT id FROM staff_users WHERE email = ?1').bind(email).first<{ id: string }>();
      staffUserId = existing?.id ?? newId();
    } else {
      const who = await sessionUser(c as unknown as C);
      if (!who) return c.json({ error: 'unauthorized' }, 401);
      const u = await c.env.DB.prepare('SELECT email FROM staff_users WHERE id = ?1').bind(who.staffUserId).first<{ email: string }>();
      staffUserId = who.staffUserId;
      email = u?.email ?? '';
    }
    const existingCreds = await c.env.DB.prepare('SELECT id, transports FROM staff_credentials WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(staffUserId).all<{ id: string; transports: string }>();
    const options = await generateRegistrationOptions({
      rpName: 'HI CO spike',
      rpID: c.env.RP_ID,
      userName: email,
      userID: enc.encode(staffUserId),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: existingCreds.results.map((r) => ({ id: r.id })),
    });
    const challengeId = newId();
    await c.env.DB.prepare('INSERT INTO webauthn_challenges (id, challenge, purpose, staff_user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(challengeId, options.challenge, 'register', staffUserId, tokenHash, now() + CHALLENGE_SECONDS)
      .run();
    return c.json({ challengeId, options });
  });

  app.post('/auth/register/verify', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { challengeId?: string; response?: RegistrationResponseJSON; label?: string } | null;
    if (!body || typeof body.challengeId !== 'string' || !body.response) return c.json({ error: 'bad_request' }, 400);
    const ch = await c.env.DB.prepare(
      `UPDATE webauthn_challenges SET used_at = ?2 WHERE id = ?1 AND purpose = 'register' AND used_at IS NULL AND expires_at > ?2
       RETURNING challenge, staff_user_id, token_hash`,
    )
      .bind(body.challengeId, now())
      .first<{ challenge: string; staff_user_id: string; token_hash: string | null }>();
    if (!ch) return c.json({ error: 'invalid_challenge' }, 400);
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: c.env.ORIGIN,
        expectedRPID: c.env.RP_ID,
        requireUserVerification: true,
      });
    } catch {
      return c.json({ error: 'verification_failed' }, 400);
    }
    if (!verified.verified) return c.json({ error: 'verification_failed' }, 400);
    const cred = verified.registrationInfo.credential;
    const db = c.env.DB;
    let staffUserId = ch.staff_user_id;
    let action = 'staff.credential.added';

    if (ch.token_hash) {
      // Consume the token exactly once (atomic): a second use changes no row.
      const t = await db.prepare(
        `UPDATE staff_tokens SET used_at = ?2 WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 RETURNING purpose, email, property_id, role`,
      ).bind(ch.token_hash, now()).first<{ purpose: 'invite' | 'recovery'; email: string; property_id: string | null; role: string | null }>();
      if (!t) return c.json({ error: 'invalid_token' }, 400);
      const exists = await db.prepare('SELECT id FROM staff_users WHERE id = ?1').bind(staffUserId).first();
      if (!exists) await db.prepare('INSERT INTO staff_users (id, email, created_at) VALUES (?1, ?2, ?3)').bind(staffUserId, t.email, now()).run();
      if (t.purpose === 'invite' && t.property_id && t.role) {
        await db.prepare('INSERT OR IGNORE INTO staff_memberships (staff_user_id, property_id, role) VALUES (?1, ?2, ?3)').bind(staffUserId, t.property_id, t.role).run();
        action = exists ? 'staff.invite.accepted' : 'staff.invite.accepted';
      } else if (t.purpose === 'recovery') {
        // Recovery replaces access: every old session and credential stops working at once.
        await db.batch([
          db.prepare('UPDATE staff_sessions SET revoked_at = ?2 WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(staffUserId, now()),
          db.prepare('UPDATE staff_credentials SET revoked_at = ?2 WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(staffUserId, now()),
        ]);
        action = 'staff.recovery.completed';
      }
    }
    await db.prepare('INSERT INTO staff_credentials (id, staff_user_id, public_key, counter, transports, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(cred.id, staffUserId, cred.publicKey, cred.counter, (cred.transports ?? []).join(','), String(body.label ?? '').slice(0, 80), now())
      .run();
    await auditPerson(db, staffUserId, action);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (ch.token_hash) headers.set('Set-Cookie', cookieHeader(await startSession(c.env, staffUserId), SESSION_SECONDS));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  });

  // ---- sign-in with a discoverable passkey (no username typed) ----
  app.post('/auth/login/options', async (c) => {
    const options = await generateAuthenticationOptions({ rpID: c.env.RP_ID, userVerification: 'required' });
    const challengeId = newId();
    await c.env.DB.prepare("INSERT INTO webauthn_challenges (id, challenge, purpose, expires_at) VALUES (?1, ?2, 'login', ?3)").bind(challengeId, options.challenge, now() + CHALLENGE_SECONDS).run();
    return c.json({ challengeId, options });
  });

  app.post('/auth/login/verify', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { challengeId?: string; response?: AuthenticationResponseJSON } | null;
    if (!body || typeof body.challengeId !== 'string' || !body.response) return c.json({ error: 'bad_request' }, 400);
    const ch = await c.env.DB.prepare(
      `UPDATE webauthn_challenges SET used_at = ?2 WHERE id = ?1 AND purpose = 'login' AND used_at IS NULL AND expires_at > ?2 RETURNING challenge`,
    ).bind(body.challengeId, now()).first<{ challenge: string }>();
    const fail = () => c.json({ error: 'sign_in_failed' }, 401); // one answer for every reason
    if (!ch) return fail();
    const cred = await c.env.DB.prepare(
      `SELECT c.id, c.staff_user_id, c.public_key, c.counter, c.transports FROM staff_credentials c JOIN staff_users u ON u.id = c.staff_user_id
       WHERE c.id = ?1 AND c.revoked_at IS NULL AND u.disabled_at IS NULL`,
    ).bind(body.response.id).first<{ id: string; staff_user_id: string; public_key: unknown; counter: number; transports: string }>();
    if (!cred) return fail();
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: c.env.ORIGIN,
        expectedRPID: c.env.RP_ID,
        requireUserVerification: true,
        credential: { id: cred.id, publicKey: bytes(cred.public_key) as Uint8Array<ArrayBuffer>, counter: cred.counter, transports: cred.transports ? (cred.transports.split(',') as never) : undefined },
      });
    } catch {
      return fail();
    }
    if (!result.verified) return fail();
    await c.env.DB.prepare('UPDATE staff_credentials SET counter = ?2, last_used_at = ?3 WHERE id = ?1').bind(cred.id, result.authenticationInfo.newCounter, now()).run();
    const token = await startSession(c.env, cred.staff_user_id);
    await auditPerson(c.env.DB, cred.staff_user_id, 'staff.signin');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader(token, SESSION_SECONDS) } });
  });

  // ---- sessions and credentials ----
  app.get('/auth/me', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const u = await c.env.DB.prepare('SELECT email FROM staff_users WHERE id = ?1').bind(who.staffUserId).first<{ email: string }>();
    return c.json({ email: u?.email });
  });

  app.get('/auth/sessions', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const { results } = await c.env.DB.prepare('SELECT id, created_at, expires_at FROM staff_sessions WHERE staff_user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2 ORDER BY created_at').bind(who.staffUserId, now()).all<{ id: string; created_at: number; expires_at: number }>();
    return c.json(results.map((r) => ({ handle: r.id.slice(0, 12), createdAt: r.created_at, expiresAt: r.expires_at, current: r.id === who.sessionId })));
  });

  app.post('/auth/sessions/revoke', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as { handle?: string } | null;
    if (!body || typeof body.handle !== 'string' || body.handle.length !== 12) return c.json({ error: 'bad_request' }, 400);
    const r = await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at = ?3 WHERE staff_user_id = ?1 AND substr(id, 1, 12) = ?2 AND revoked_at IS NULL').bind(who.staffUserId, body.handle, now()).run();
    if (r.meta.changes > 0) await auditPerson(c.env.DB, who.staffUserId, 'staff.session.revoked');
    return c.json({ revoked: r.meta.changes });
  });

  app.post('/auth/logout', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (who) {
      await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at = ?2 WHERE id = ?1').bind(who.sessionId, now()).run();
      await auditPerson(c.env.DB, who.staffUserId, 'staff.signout');
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader('', 0) } });
  });

  app.post('/auth/logout-all', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at = ?2 WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(who.staffUserId, now()).run();
    await auditPerson(c.env.DB, who.staffUserId, 'staff.signout_all');
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader('', 0) } });
  });

  app.get('/auth/credentials', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const { results } = await c.env.DB.prepare('SELECT id, label, created_at, last_used_at FROM staff_credentials WHERE staff_user_id = ?1 AND revoked_at IS NULL ORDER BY created_at').bind(who.staffUserId).all();
    return c.json(results);
  });

  app.post('/auth/credentials/revoke', async (c) => {
    const who = await sessionUser(c as unknown as C);
    if (!who) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
    if (!body || typeof body.id !== 'string') return c.json({ error: 'bad_request' }, 400);
    const active = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM staff_credentials WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(who.staffUserId).first<{ n: number }>();
    if ((active?.n ?? 0) < 2) return c.json({ error: 'last_credential' }, 409); // never lock a person out by their own hand
    const r = await c.env.DB.prepare('UPDATE staff_credentials SET revoked_at = ?3 WHERE id = ?1 AND staff_user_id = ?2 AND revoked_at IS NULL').bind(body.id, who.staffUserId, now()).run();
    if (r.meta.changes > 0) await auditPerson(c.env.DB, who.staffUserId, 'staff.credential.revoked');
    return c.json({ revoked: r.meta.changes });
  });

  // ---- the seam: the real tenant layer, with the session cookie as the StaffResolver ----
  const staffRoutes = new Hono<{ Bindings: SpikeEnv }>();
  staffRoutes.use('*', staffTenant(async (c) => {
    const who = await sessionUser({ env: c.env as SpikeEnv, req: { raw: c.req.raw, header: (n) => c.req.raw.headers.get(n) ?? undefined, json: () => c.req.raw.json() } });
    return who ? { staffUserId: who.staffUserId } : null;
  }) as never);
  staffRoutes.get('/me', (c) => c.json({ role: (c as unknown as { get: (k: string) => { role: string } }).get('staff').role }));
  app.route('/staff/p/:slug', staffRoutes);

  // ---- test support (only when SPIKE_TEST=on) ----
  app.use('/__test/*', async (c, next) => (c.env.SPIKE_TEST === 'on' ? next() : c.json({ error: 'not_found' }, 404)));
  app.post('/__test/seed', async (c) => {
    const out: Record<string, string> = {};
    for (const slug of ['spike-a', 'spike-b']) {
      const id = newId();
      await c.env.DB.prepare("INSERT INTO properties (id, slug, name_en, name_fr, timezone, address, languages, created_at) VALUES (?1, ?2, ?3, ?3, 'America/Vancouver', '', 'en,fr', 1)").bind(id, slug, slug).run();
      out[slug] = id;
    }
    return c.json(out);
  });
  app.post('/__test/operator-invite', async (c) => {
    const b = (await c.req.json()) as { email: string; slug: string; role: 'editor' | 'admin' };
    const p = await c.env.DB.prepare('SELECT id FROM properties WHERE slug = ?1').bind(b.slug).first<{ id: string }>();
    const token = randomToken();
    await c.env.DB.prepare(`INSERT INTO staff_tokens (token_hash, purpose, email, property_id, role, created_at, expires_at) VALUES (?1, 'invite', ?2, ?3, ?4, ?5, ?6)`)
      .bind(await hmacHex(c.env.SESSION_PEPPER, token), b.email.toLowerCase(), p?.id, b.role, now(), now() + TOKEN_SECONDS).run();
    return c.json({ token });
  });
  app.post('/__test/sql', async (c) => {
    const b = (await c.req.json()) as { sql: string; params?: unknown[] };
    const r = await c.env.DB.prepare(b.sql).bind(...(b.params ?? [])).all();
    return c.json(r.results);
  });
  app.get('/__test/capture', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT to_email, subject, body FROM email_capture ORDER BY id').all();
    return c.json(results);
  });
  app.get('/__test/audit', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT p.slug, a.action, a.actor_staff_id FROM audit_log a JOIN properties p ON p.id = a.property_id ORDER BY a.created_at, a.rowid').all();
    return c.json(results);
  });

  app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}

const app = createSpikeApp();
export default { fetch: (request: Request, env: SpikeEnv, ctx: ExecutionContext) => app.fetch(request, env, ctx) };
