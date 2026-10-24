import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from '../support/app.ts';
import { addPasskey, makeProperty, makeStaff, nameStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';
import { randomToken, sha256Hex } from '../../worker/security.ts';
import { tokens } from '../../worker/repositories/index.ts';

// Staff sign-in, sessions, passkeys, links and the people routes: everything that does not need a real
// authenticator. The WebAuthn ceremonies themselves are proved in tests/e2e with Chromium's virtual one.

const AUTH = '/api/staff/auth';
let A: PropertyFixture, B: PropertyFixture;
let adminA: string, editorA: string, adminB: string, adminAB: string;
let cAdminA: string, cEditorA: string, cAdminB: string, cAdminAB: string;
const ip = (n: number) => ({ 'CF-Connecting-IP': `203.0.113.${n}` });
const as = (cookie: string, extra: Record<string, string> = {}) => ({ host: A.host, headers: { Cookie: cookie, ...extra } });

async function rowsFor(action: string, propertyId?: string) {
  const sql = propertyId
    ? 'SELECT property_id, actor_staff_id FROM audit_log WHERE action = ?1 AND property_id = ?2'
    : 'SELECT property_id, actor_staff_id FROM audit_log WHERE action = ?1';
  const stmt = propertyId ? env.DB.prepare(sql).bind(action, propertyId) : env.DB.prepare(sql).bind(action);
  return (await stmt.all<{ property_id: string; actor_staff_id: string }>()).results;
}

beforeAll(async () => {
  A = await makeProperty(env.DB, 'sa-a', { host: 'sa.test' });
  B = await makeProperty(env.DB, 'sa-b', { host: 'sa-b.test' });
  adminA = await makeStaff(env.DB, 'admin-a@sa.test', [{ propertyId: A.id, role: 'admin' }]);
  editorA = await makeStaff(env.DB, 'editor-a@sa.test', [{ propertyId: A.id, role: 'editor' }]);
  adminB = await makeStaff(env.DB, 'admin-b@sa.test', [{ propertyId: B.id, role: 'admin' }]);
  adminAB = await makeStaff(env.DB, 'admin-ab@sa.test', [{ propertyId: A.id, role: 'admin' }, { propertyId: B.id, role: 'admin' }]);
  for (const [id, name] of [[adminA, 'Alex Admin'], [editorA, 'Eli Editor'], [adminB, 'Bea Admin'], [adminAB, 'Cam Both']] as const) await nameStaff(env.DB, id, name);
  await addPasskey(env.DB, adminA, 'pk-adminA', 'Alex phone');
  cAdminA = await sessionCookieFor(env.DB, adminA);
  cEditorA = await sessionCookieFor(env.DB, editorA);
  cAdminB = await sessionCookieFor(env.DB, adminB);
  cAdminAB = await sessionCookieFor(env.DB, adminAB);
});

describe('configuration', () => {
  it('answers 503 until the relying party is configured, and never reads it from the request', async () => {
    expect((await call(`${AUTH}/login/options`, { method: 'POST', body: {}, env: { RP_ID: '' } })).status).toBe(503);
    expect((await call(`${AUTH}/login/options`, { method: 'POST', body: {}, env: { ALLOWED_ORIGINS: '' } })).status).toBe(503);
    expect((await call(`${AUTH}/login/options`, { method: 'POST', body: {}, headers: { ...ip(1), 'X-Forwarded-Host': 'evil.example' } })).status).toBe(200);
    const body = (await (await call(`${AUTH}/login/options`, { method: 'POST', body: {}, headers: ip(2) })).json()) as { options: { rpId: string; userVerification: string } };
    expect(body.options.rpId).toBe('localhost');
    expect(body.options.userVerification).toBe('required');
  });
});

describe('who am I, sessions and sign-out', () => {
  it('/me needs a live session and names only the person\'s own properties', async () => {
    expect((await call(`${AUTH}/me`)).status).toBe(401);
    const res = await call(`${AUTH}/me`, as(cAdminAB));
    const me = (await res.json()) as { displayName: string; email: string; passkeys: number; properties: { slug: string; role: string }[] };
    expect(me.displayName).toBe('Cam Both');
    expect(me.properties.map((p) => `${p.slug}:${p.role}`)).toEqual(['sa-a:admin', 'sa-b:admin']);
    const one = (await (await call(`${AUTH}/me`, as(cEditorA))).json()) as { properties: { slug: string }[] };
    expect(one.properties.map((p) => p.slug)).toEqual(['sa-a']);
    expect((await call(`${AUTH}/me`, as('hc_staff=not-a-real-token'))).status).toBe(401);
    expect((await call(`${AUTH}/me`, as(`hc_staff=${'x'.repeat(500)}`))).status).toBe(401);
  });

  it('an expired session and a revoked session are refused on the next request', async () => {
    const expired = await sessionCookieFor(env.DB, adminA, -10);
    expect((await call(`${AUTH}/me`, as(expired))).status).toBe(401);
    const c = await sessionCookieFor(env.DB, adminA);
    expect((await call(`${AUTH}/me`, as(c))).status).toBe(200);
    await env.DB.prepare('UPDATE staff_sessions SET revoked_at = 1 WHERE id = ?1').bind(await sha256Hex(c.split('=')[1] as string)).run();
    expect((await call(`${AUTH}/me`, as(c))).status).toBe(401);
  });

  it('sign-out revokes this session at once, clears the cookie and is audited under each property', async () => {
    const c = await sessionCookieFor(env.DB, adminAB);
    const res = await call(`${AUTH}/logout`, { ...as(c), method: 'POST', body: {} });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect((await call(`${AUTH}/me`, as(c))).status).toBe(401);
    const rows = (await rowsFor('staff.signout')).filter((r) => r.actor_staff_id === adminAB).map((r) => r.property_id).sort();
    expect(rows).toEqual([A.id, B.id].sort());
    // Signing out with no session is harmless and writes nothing.
    const before = (await rowsFor('staff.signout')).length;
    expect((await call(`${AUTH}/logout`, { host: A.host, method: 'POST', body: {} })).status).toBe(200);
    expect((await rowsFor('staff.signout')).length).toBe(before);
  });

  it('sign-out everywhere ends every session of that person and no one else\'s', async () => {
    const one = await sessionCookieFor(env.DB, editorA);
    const two = await sessionCookieFor(env.DB, editorA);
    expect((await call(`${AUTH}/logout-all`, { ...as(one), method: 'POST', body: {} })).status).toBe(200);
    expect((await call(`${AUTH}/me`, as(one))).status).toBe(401);
    expect((await call(`${AUTH}/me`, as(two))).status).toBe(401);
    expect((await call(`${AUTH}/me`, as(cAdminA))).status).toBe(200);
    expect((await rowsFor('staff.signout_all', A.id)).some((r) => r.actor_staff_id === editorA)).toBe(true);
    cEditorA = await sessionCookieFor(env.DB, editorA);
  });

  it('sessions list and revoke by handle; another person\'s handle does nothing', async () => {
    // A person of their own, so the shared sessions used by the other tests are not touched.
    const person = await makeStaff(env.DB, 'sessions@sa.test', [{ propertyId: B.id, role: 'editor' }]);
    const mine = await sessionCookieFor(env.DB, person);
    const other = await sessionCookieFor(env.DB, person);
    const list = (await (await call(`${AUTH}/sessions`, as(mine))).json()) as { handle: string; current: boolean }[];
    expect(list.length).toBe(2);
    expect(list.filter((s) => s.current).length).toBe(1);
    expect(list.every((s) => /^[0-9a-f]{12}$/.test(s.handle))).toBe(true);
    const target = list.find((s) => !s.current);
    // A different person cannot revoke it.
    const stranger = await call(`${AUTH}/sessions/revoke`, { ...as(cAdminA), method: 'POST', body: { handle: target?.handle } });
    expect(await stranger.json()).toEqual({ revoked: 0 });
    expect((await call(`${AUTH}/me`, as(other))).status).toBe(200);
    const done = await call(`${AUTH}/sessions/revoke`, { ...as(mine), method: 'POST', body: { handle: target?.handle } });
    expect(await done.json()).toEqual({ revoked: 1 });
    expect((await call(`${AUTH}/sessions/revoke`, { ...as(mine), method: 'POST', body: { handle: 'zz' } })).status).toBe(400);
    expect((await rowsFor('staff.session.revoked', B.id)).some((r) => r.actor_staff_id === person)).toBe(true);
  });
});

describe('passkeys', () => {
  it('list, rename, and the last passkey cannot be revoked', async () => {
    const list = (await (await call(`${AUTH}/credentials`, as(cAdminA))).json()) as { id: string; label: string }[];
    expect(list.map((c) => c.id)).toEqual(['pk-adminA']);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(['createdAt', 'id', 'label', 'lastUsedAt']); // no key material
    expect((await call(`${AUTH}/credentials/rename`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminA', label: 'Alex main phone' } })).status).toBe(200);
    const last = await call(`${AUTH}/credentials/revoke`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminA' } });
    expect(last.status).toBe(409);
    expect(await last.json()).toEqual({ error: 'last_credential' });
    await addPasskey(env.DB, adminA, 'pk-adminA-2', 'Key');
    expect((await call(`${AUTH}/credentials/revoke`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminA-2' } })).status).toBe(200);
    expect((await rowsFor('staff.passkey.revoked', A.id)).length).toBe(1);
  });

  it('nobody can touch another person\'s passkey', async () => {
    await addPasskey(env.DB, adminB, 'pk-adminB', 'Bea phone');
    await addPasskey(env.DB, adminB, 'pk-adminB-2', 'Bea key');
    expect((await call(`${AUTH}/credentials/revoke`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminB-2' } })).status).toBe(409); // adminA has one
    await addPasskey(env.DB, adminA, 'pk-adminA-3', 'x');
    expect((await call(`${AUTH}/credentials/revoke`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminB-2' } })).status).toBe(404);
    expect((await call(`${AUTH}/credentials/rename`, { ...as(cAdminA), method: 'POST', body: { id: 'pk-adminB', label: 'mine now' } })).status).toBe(404);
    const bs = (await (await call(`${AUTH}/credentials`, as(cAdminB))).json()) as { label: string }[];
    expect(bs.map((c) => c.label).sort()).toEqual(['Bea key', 'Bea phone']);
  });
});

describe('links', () => {
  async function invite(cookie: string, body: Record<string, unknown>, host = A.host) {
    return call(`/api/staff/p/${host === A.host ? A.slug : B.slug}/people/invite`, { host, method: 'POST', headers: { Cookie: cookie }, body });
  }

  it('an invite link is inspected without being used, never stored in the clear, and used only once', async () => {
    const res = await invite(cAdminA, { email: 'New.Person@Sa.test', displayName: 'Nia New', role: 'editor' });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string; expiresAt: number };
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await env.DB.prepare('SELECT token_hash, email FROM staff_tokens WHERE email = ?1').bind('new.person@sa.test').first<{ token_hash: string; email: string }>();
    expect(stored?.token_hash).toBe(await sha256Hex(token));
    expect(stored?.token_hash).not.toBe(token);
    const all = JSON.stringify((await env.DB.prepare('SELECT token_hash, email, display_name, property_id, role FROM staff_tokens').all()).results);
    expect(all).not.toContain(token);
    const peek = await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token }, headers: ip(10) });
    expect(await peek.json()).toEqual({ purpose: 'invite', displayName: 'Nia New', existingUser: false });
    expect((await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token }, headers: ip(10) })).status).toBe(200); // still unused
    expect(await tokens.consume(env.DB, await sha256Hex(token), Math.floor(Date.now() / 1000))).not.toBeNull();
    expect((await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token }, headers: ip(10) })).status).toBe(400);
  });

  it('unknown, malformed and expired links all look the same', async () => {
    const unknown = await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token: randomToken() }, headers: ip(11) });
    const malformed = await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token: 'short' }, headers: ip(11) });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'invalid_link' });
    expect(await malformed.json()).toEqual({ error: 'invalid_link' });
    const t = randomToken();
    await tokens.createInvite(env.DB, { hash: await sha256Hex(t), email: 'late@sa.test', displayName: 'Late', propertyId: A.id, role: 'editor', createdBy: adminA }, 1, 10);
    expect(await (await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token: t }, headers: ip(11) })).json()).toEqual({ error: 'invalid_link' });
  });

  it('registration options: a new person from an invite, a recovery link, or a signed-in person adding a passkey', async () => {
    const { token } = (await (await invite(cAdminA, { email: 'opts@sa.test', displayName: 'Opt In', role: 'editor' })).json()) as { token: string };
    const res = await call(`${AUTH}/register/options`, { host: A.host, method: 'POST', body: { token }, headers: ip(12) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { challengeId: string; options: { user: { name: string; displayName: string }; rp: { id: string }; excludeCredentials?: unknown[]; authenticatorSelection: { residentKey: string; userVerification: string } } };
    expect(body.options.user.name).toBe('opts@sa.test');
    expect(body.options.user.displayName).toBe('Opt In');
    expect(body.options.rp.id).toBe('localhost');
    expect(body.options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });
    // Signed in: the person's existing passkeys are excluded so the same device is not registered twice.
    const own = await call(`${AUTH}/register/options`, { ...as(cAdminA, ip(13)), method: 'POST', body: {} });
    const ownBody = (await own.json()) as { options: { excludeCredentials: { id: string }[] } };
    expect(ownBody.options.excludeCredentials.map((c) => c.id)).toContain('pk-adminA');
    // Neither a link nor a session: refused.
    expect((await call(`${AUTH}/register/options`, { host: A.host, method: 'POST', body: {}, headers: ip(14) })).status).toBe(401);
  });

  it('an invite can never register a passkey on an account that already exists', async () => {
    const res = await invite(cAdminA, { email: 'Admin-B@sa.test', displayName: 'Hijack', role: 'admin' });
    expect(res.status).toBe(200); // allowed: it only offers the person a role; they sign in to accept it
    const { token, existingUser } = (await res.json()) as { token: string; existingUser: boolean };
    expect(existingUser).toBe(true);
    const opts = await call(`${AUTH}/register/options`, { host: A.host, method: 'POST', body: { token }, headers: ip(15) });
    expect(opts.status).toBe(409);
    expect(await opts.json()).toEqual({ error: 'existing_user' });
    const peek = (await (await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token }, headers: ip(15) })).json()) as { existingUser: boolean };
    expect(peek.existingUser).toBe(true);
  });

  it('an existing person from another property accepts an invite: only the person named, signed in, once; the role and an audit row appear', async () => {
    const issued = await call(`/api/staff/p/sa-b/people/invite`, { host: B.host, method: 'POST', headers: { Cookie: cAdminB }, body: { email: 'editor-a@sa.test', displayName: 'Eli', role: 'editor' } });
    expect(issued.status).toBe(200);
    const { token } = (await issued.json()) as { token: string };
    expect((await call(`${AUTH}/link/accept`, { host: A.host, method: 'POST', body: { token }, headers: ip(17) })).status).toBe(401); // signed out
    expect((await call(`${AUTH}/link/accept`, { ...as(cAdminA, ip(17)), method: 'POST', body: { token } })).status).toBe(400); // signed in, but not the person named
    const ok = await call(`${AUTH}/link/accept`, { ...as(cEditorA, ip(17)), method: 'POST', body: { token } });
    expect(await ok.json()).toEqual({ ok: true, slug: 'sa-b' });
    expect((await call(`${AUTH}/link/accept`, { ...as(cEditorA, ip(17)), method: 'POST', body: { token } })).status).toBe(400); // once
    const me = (await (await call(`${AUTH}/me`, as(cEditorA))).json()) as { properties: { slug: string; role: string }[] };
    expect(me.properties.map((p) => `${p.slug}:${p.role}`)).toEqual(['sa-a:editor', 'sa-b:editor']);
    expect((await rowsFor('staff.invite.accepted')).some((r) => r.actor_staff_id === editorA)).toBe(true);
    await env.DB.prepare('DELETE FROM staff_memberships WHERE staff_user_id = ?1 AND property_id = ?2').bind(editorA, B.id).run();
  });
  it('a registration that fails verification does not use up the link', async () => {
    const { token } = (await (await invite(cAdminA, { email: 'keep@sa.test', displayName: 'Keep', role: 'editor' })).json()) as { token: string };
    const opts = (await (await call(`${AUTH}/register/options`, { host: A.host, method: 'POST', body: { token }, headers: ip(18) })).json()) as { challengeId: string };
    const bad = await call(`${AUTH}/register/verify`, { host: A.host, method: 'POST', body: { challengeId: opts.challengeId, response: { id: 'x', rawId: 'x', type: 'public-key', response: {} } }, headers: ip(18) });
    expect(bad.status).toBe(400);
    expect((await call(`${AUTH}/link/inspect`, { host: A.host, method: 'POST', body: { token }, headers: ip(18) })).status).toBe(200); // still usable
    // The challenge, however, is spent: a second attempt with it is refused.
    const again = await call(`${AUTH}/register/verify`, { host: A.host, method: 'POST', body: { challengeId: opts.challengeId, response: { id: 'x' } }, headers: ip(18) });
    expect(again.status).toBe(400);
  });

  it('sign-in failures all answer the same way', async () => {
    const opts = (await (await call(`${AUTH}/login/options`, { method: 'POST', body: {}, headers: ip(19) })).json()) as { challengeId: string };
    const a = await call(`${AUTH}/login/verify`, { method: 'POST', body: { challengeId: opts.challengeId, response: { id: 'no-such-passkey' } }, headers: ip(19) });
    const b = await call(`${AUTH}/login/verify`, { method: 'POST', body: { challengeId: opts.challengeId, response: { id: 'pk-adminA' } }, headers: ip(19) }); // challenge already used
    const c = await call(`${AUTH}/login/verify`, { method: 'POST', body: { nonsense: true }, headers: ip(19) });
    for (const r of [a, b, c]) {
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'sign_in_failed' });
    }
  });
});

describe('rate limiting', () => {
  it('refuses the 41st sign-in attempt from one address in a window, and counts addresses separately', async () => {
    const same = ip(99);
    let last = 200;
    for (let i = 0; i < 41; i += 1) last = (await call(`${AUTH}/login/options`, { method: 'POST', body: {}, headers: same })).status;
    expect(last).toBe(429);
    expect((await call(`${AUTH}/login/options`, { method: 'POST', body: {}, headers: ip(98) })).status).toBe(200);
  });
});

describe('people routes: the role matrix', () => {
  const slug = 'sa-a';
  const any = '0'.repeat(32);
  const routes: { name: string; method: 'GET' | 'POST'; path: string; body?: unknown }[] = [
    { name: 'list people', method: 'GET', path: `/api/staff/p/${slug}/people` },
    { name: 'invite', method: 'POST', path: `/api/staff/p/${slug}/people/invite`, body: { email: 'matrix@sa.test', displayName: 'Matrix', role: 'editor' } },
    { name: 'change role', method: 'POST', path: `/api/staff/p/${slug}/people/${any}/role`, body: { role: 'editor' } },
    { name: 'remove', method: 'POST', path: `/api/staff/p/${slug}/people/${any}/remove`, body: {} },
    { name: 'recovery link', method: 'POST', path: `/api/staff/p/${slug}/people/${any}/recovery`, body: {} },
    { name: 'revoke sessions', method: 'POST', path: `/api/staff/p/${slug}/people/${any}/revoke-sessions`, body: {} },
  ];

  it.each(routes)('$name: signed out 401, editor 403, an admin of another property 404', async ({ method, path, body }) => {
    expect((await call(path, { host: A.host, method, body })).status).toBe(401);
    expect((await call(path, { host: A.host, method, body, headers: { Cookie: cEditorA } })).status).toBe(403);
    expect((await call(path, { host: A.host, method, body, headers: { Cookie: cAdminB } })).status).toBe(404); // a valid sign-in, no role here: nothing
  });

  it('a disabled person gets nothing at once', async () => {
    const p = await makeStaff(env.DB, 'disabled-admin@sa.test', [{ propertyId: A.id, role: 'admin' }]);
    const c = await sessionCookieFor(env.DB, p);
    expect((await call(`/api/staff/p/${slug}/people`, { host: A.host, headers: { Cookie: c } })).status).toBe(200);
    await env.DB.prepare('UPDATE staff_users SET disabled_at = 5 WHERE id = ?1').bind(p).run();
    expect((await call(`/api/staff/p/${slug}/people`, { host: A.host, headers: { Cookie: c } })).status).toBe(401);
  });

  it('an admin lists their own property\'s people with no secrets', async () => {
    const res = await call(`/api/staff/p/${slug}/people`, { host: A.host, headers: { Cookie: cAdminA } });
    const rows = (await res.json()) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['displayName', 'email', 'id', 'lastSignInAt', 'passkeys', 'role']);
    expect(rows.some((r) => r.displayName === 'Bea Admin')).toBe(false); // B's admin is not A's person
  });

  it('invite: bad bodies are refused, an existing member cannot be invited again, the link is audited', async () => {
    const post = (body: unknown) => call(`/api/staff/p/${slug}/people/invite`, { host: A.host, method: 'POST', headers: { Cookie: cAdminA }, body });
    expect((await post({ email: 'not-an-email', displayName: 'X', role: 'editor' })).status).toBe(400);
    expect((await post({ email: 'x@sa.test', displayName: '', role: 'editor' })).status).toBe(400);
    expect((await post({ email: 'x@sa.test', displayName: 'X', role: 'owner' })).status).toBe(400);
    expect((await post({ email: 'x@sa.test', displayName: 'X', role: 'editor', extra: 1 })).status).toBe(400);
    expect((await post({ email: 'x@sa.test', displayName: 'x'.repeat(81), role: 'editor' })).status).toBe(400);
    expect((await post({ email: 'editor-a@sa.test', displayName: 'Eli', role: 'editor' })).status).toBe(409);
    const before = (await rowsFor('staff.invite.created', A.id)).length;
    const beforeB = (await rowsFor('staff.invite.created', B.id)).length;
    expect((await post({ email: 'audit@sa.test', displayName: 'Audit', role: 'editor' })).status).toBe(200);
    expect((await rowsFor('staff.invite.created', A.id)).length).toBe(before + 1);
    expect((await rowsFor('staff.invite.created', B.id)).length).toBe(beforeB); // nothing lands under the other property
  });

  it('role changes and removals: refused for the last admin, ignored across properties, audited', async () => {
    const solo = await makeProperty(env.DB, 'sa-solo', { host: 'sa-solo.test' });
    const boss = await makeStaff(env.DB, 'boss@sa.test', [{ propertyId: solo.id, role: 'admin' }]);
    const hand = await makeStaff(env.DB, 'hand@sa.test', [{ propertyId: solo.id, role: 'editor' }]);
    const cBoss = await sessionCookieFor(env.DB, boss);
    const cHand = await sessionCookieFor(env.DB, hand);
    const at = (cookie: string, path: string, body: unknown) => call(`/api/staff/p/sa-solo/people/${path}`, { host: solo.host, method: 'POST', headers: { Cookie: cookie }, body });
    expect(await (await at(cBoss, `${boss}/role`, { role: 'editor' })).json()).toEqual({ error: 'last_admin' });
    expect(await (await at(cBoss, `${boss}/remove`, {})).json()).toEqual({ error: 'last_admin' });
    expect((await at(cBoss, `${hand}/role`, { role: 'admin' })).status).toBe(200); // a second admin now exists
    expect((await at(cBoss, `${boss}/role`, { role: 'editor' })).status).toBe(200); // so the first may step down
    expect((await at(cBoss, `${hand}/remove`, {})).status).toBe(403); // ...and as an editor can no longer manage people
    expect(await (await at(cHand, `${hand}/remove`, {})).json()).toEqual({ error: 'last_admin' }); // the remaining admin is the last
    expect((await at(cHand, `${boss}/remove`, {})).status).toBe(200);
    expect((await at(cHand, `${boss}/remove`, {})).status).toBe(404); // already gone
    // adminA names a person who is only in B: not found, nothing changed.
    expect((await call(`/api/staff/p/sa-a/people/${adminB}/role`, { host: A.host, method: 'POST', headers: { Cookie: cAdminA }, body: { role: 'editor' } })).status).toBe(404);
    expect((await call(`/api/staff/p/sa-a/people/${adminB}/remove`, { host: A.host, method: 'POST', headers: { Cookie: cAdminA }, body: {} })).status).toBe(404);
    expect((await env.DB.prepare('SELECT role FROM staff_memberships WHERE staff_user_id = ?1').bind(adminB).first<{ role: string }>())?.role).toBe('admin');
    expect((await rowsFor('staff.role.changed', solo.id)).length).toBe(2);
    expect((await rowsFor('staff.member.removed', solo.id)).length).toBe(1);
  });
  it('recovery links need an admin role at every property the person belongs to; the rest is the operator', async () => {
    const rec = (cookie: string, id: string, slugOf = 'sa-a', host = A.host) => call(`/api/staff/p/${slugOf}/people/${id}/recovery`, { host, method: 'POST', headers: { Cookie: cookie }, body: {} });
    const ok = await rec(cAdminA, editorA);
    expect(ok.status).toBe(200);
    const { token } = (await ok.json()) as { token: string };
    expect(await tokens.inspect(env.DB, await sha256Hex(token), Math.floor(Date.now() / 1000))).toMatchObject({ purpose: 'recovery', staffUserId: editorA });
    expect((await rowsFor('staff.recovery.issued', A.id)).length).toBeGreaterThan(0);
    // adminAB belongs to A and B: an admin of A alone cannot take over their account.
    const refused = await rec(cAdminA, adminAB);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: 'needs_operator' });
    expect((await rec(cAdminAB, adminA)).status).toBe(200);
    // A person who is not in this property: not found.
    expect((await rec(cAdminA, adminB)).status).toBe(404);
    // The recovery link works as a registration link for that person only.
    const opts = await call(`${AUTH}/register/options`, { host: A.host, method: 'POST', body: { token }, headers: ip(30) });
    expect(opts.status).toBe(200);
    expect(((await opts.json()) as { options: { user: { name: string } } }).options.user.name).toBe('editor-a@sa.test');
  });

  it('revoking a person\'s sessions follows the same every-property rule', async () => {
    const victim = await sessionCookieFor(env.DB, editorA);
    const res = await call(`/api/staff/p/sa-a/people/${editorA}/revoke-sessions`, { host: A.host, method: 'POST', headers: { Cookie: cAdminA }, body: {} });
    expect(res.status).toBe(200);
    expect((await call(`${AUTH}/me`, as(victim))).status).toBe(401);
    const refused = await call(`/api/staff/p/sa-a/people/${adminAB}/revoke-sessions`, { host: A.host, method: 'POST', headers: { Cookie: cAdminA }, body: {} });
    expect(refused.status).toBe(403);
    expect((await call(`${AUTH}/me`, as(cAdminAB))).status).toBe(200);
    cEditorA = await sessionCookieFor(env.DB, editorA);
  });
});

describe('request guards on staff writes', () => {
  it('need a matching Origin and JSON, and answer 503 while the platform is read-only', async () => {
    const path = `/api/staff/p/sa-a/people/invite`;
    const body = { email: 'guard@sa.test', displayName: 'Guard', role: 'editor' };
    expect((await call(path, { host: A.host, method: 'POST', body, headers: { Cookie: cAdminA, Origin: 'https://evil.example' } })).status).toBe(403);
    const text = await call(path, { host: A.host, method: 'POST', headers: { Cookie: cAdminA, Origin: `https://${A.host}`, 'Content-Type': 'text/plain' } });
    expect(text.status).toBe(415);
    await env.DB.prepare("UPDATE platform_flags SET value = 'on' WHERE key = 'read_only'").run();
    try {
      const { resetReadOnlyCache } = await import('../support/app.ts');
      resetReadOnlyCache();
      expect((await call(path, { host: A.host, method: 'POST', body, headers: { Cookie: cAdminA } })).status).toBe(503);
      expect((await call(`/api/staff/p/sa-a/people`, { host: A.host, headers: { Cookie: cAdminA } })).status).toBe(200); // reads continue
    } finally {
      await env.DB.prepare("UPDATE platform_flags SET value = 'off' WHERE key = 'read_only'").run();
      const { resetReadOnlyCache } = await import('../support/app.ts');
      resetReadOnlyCache();
    }
  });
});
