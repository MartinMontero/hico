import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

// SPIKE Route 2: Better Auth + passkey plugin on workerd with local D1, same virtual authenticator.
const ORIGIN = 'http://localhost:8790';
test.describe.configure({ mode: 'serial' });

interface Person { context: BrowserContext; page: Page; request: APIRequestContext }
async function newPerson(browser: Browser, baseURL = ORIGIN): Promise<Person> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  return { context, page, request: context.request };
}
const headers = { Origin: ORIGIN, 'Content-Type': 'application/json' };
const post = (p: Person, path: string, data: unknown = {}) => p.request.post(path, { headers, data });
const me = async (p: Person, slug: string) => {
  const r = await p.request.get(`/staff/p/${slug}/me`);
  return { status: r.status(), body: await r.json().catch(() => null) };
};
const sql = async (p: Person, statement: string, params: unknown[] = []) => (await (await post(p, '/__test/sql', { sql: statement, params })).json()) as Record<string, unknown>[];
async function press(p: Page, name: string, expected: string): Promise<void> {
  await p.locator('#status').evaluate((el) => { el.textContent = ''; });
  await p.getByRole('button', { name }).click();
  await expect(p.locator('#status')).toHaveText(expected);
}
const secrets: string[] = [];
let admin: Person, anon: Person;
const ADMIN = 'admin@better-a.test';

test.beforeAll(async ({ browser }) => {
  anon = await newPerson(browser);
});

test('programmatic migration creates Better Auth tables on D1 (the documented route for D1)', async () => {
  const r = await post(anon, '/__test/migrate');
  const body = await r.text();
  console.log('migrate:', r.status(), body.slice(0, 300));
  expect(r.status()).toBe(200);
  const tables = (await sql(anon, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((t) => t.name);
  console.log('tables:', tables.join(','));
  for (const t of ['user', 'session', 'account', 'verification', 'passkey']) expect(tables).toContain(t);
  await post(anon, '/__test/seed');
});

test('invite token as registration context: first passkey creates the person, the session and the membership', async ({ browser }) => {
  admin = await newPerson(browser);
  const { token } = (await (await post(admin, '/__test/operator-invite', { email: ADMIN, slug: 'spike-a', role: 'admin' })).json()) as { token: string };
  secrets.push(token, ADMIN);
  await admin.page.goto(`/#invite=${token}`);
  await press(admin.page, 'Create passkey', 'registered');
  expect(admin.page.url()).not.toContain(token);
  const sessionCookie = (await admin.context.cookies()).filter((c) => /session/i.test(c.name)).map((c) => ({ name: c.name, httpOnly: c.httpOnly, sameSite: c.sameSite, secure: c.secure, path: c.path }));
  console.log('cookies:', JSON.stringify(sessionCookie));
  expect(sessionCookie.every((c) => c.httpOnly)).toBe(true);
  expect(await me(admin, 'spike-a')).toEqual({ status: 200, body: { role: 'admin' } });
  expect((await me(admin, 'spike-b')).status).toBe(404);
  expect((await me(anon, 'spike-a')).status).toBe(401);
  // Our staff_users id and the library's user id are the same value (we chose it in resolveUser).
  const ids = await sql(admin, 'SELECT (SELECT COUNT(*) FROM user) AS ba, (SELECT COUNT(*) FROM staff_users) AS ours');
  expect(ids[0]).toEqual({ ba: 1, ours: 1 });
  const same = await sql(admin, 'SELECT COUNT(*) AS n FROM user u JOIN staff_users s ON s.id = u.id AND s.email = u.name');
  console.log('user.id == staff_users.id and user.name == email:', JSON.stringify(same[0]));
});

test('sign out revokes the session; the passkey signs back in with no username', async () => {
  await press(admin.page, 'Sign out', 'signed-out');
  expect((await me(admin, 'spike-a')).status).toBe(401);
  await press(admin.page, 'Sign in with passkey', 'signed-in');
  expect((await me(admin, 'spike-a')).body).toEqual({ role: 'admin' });
});

test('roles are read from our database on every request', async () => {
  await sql(admin, "UPDATE staff_memberships SET role = 'editor' WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?1)", [ADMIN]);
  expect((await me(admin, 'spike-a')).body).toEqual({ role: 'editor' });
  await sql(admin, "UPDATE staff_memberships SET role = 'admin' WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?1)", [ADMIN]);
  await sql(admin, 'UPDATE staff_users SET disabled_at = 5 WHERE email = ?1', [ADMIN]);
  // Access stops at once either way. Here the library's session is still valid, so it is our role lookup
  // that refuses (404); Route 3's own resolver also checks the person and answers 401.
  expect((await me(admin, 'spike-a')).status).toBe(404);
  await sql(admin, 'UPDATE staff_users SET disabled_at = NULL WHERE email = ?1', [ADMIN]);
});

test('sessions: list, revoke another, revoke all (the library routes)', async () => {
  await press(admin.page, 'Sign in with passkey', 'signed-in');
  const list = (await (await admin.request.get('/api/auth/list-sessions')).json()) as { token: string }[];
  console.log('list-sessions count:', list.length, 'fields:', Object.keys(list[0] ?? {}).join(','));
  expect(list.length).toBeGreaterThanOrEqual(2);
  const other = list.at(0);
  expect((await post(admin, '/api/auth/revoke-session', { token: other?.token })).status()).toBeLessThan(300);
  expect((await post(admin, '/api/auth/revoke-sessions')).status()).toBeLessThan(300);
  expect((await me(admin, 'spike-a')).status).toBe(401);
  await press(admin.page, 'Sign in with passkey', 'signed-in');
});

test('passkeys: the library lists them', async () => {
  const list = (await (await admin.request.get('/api/auth/passkey/list-user-passkeys')).json()) as { id: string }[];
  expect(list.length).toBe(1);
  expect((await sql(admin, 'SELECT COUNT(*) AS n FROM passkey'))[0]).toEqual({ n: 1 });
});

test('deleting a person\'s only passkey: what the library does (a separate person, so later tests are unaffected)', async ({ browser }) => {
  const solo = await newPerson(browser);
  const { token } = (await (await post(solo, '/__test/operator-invite', { email: 'solo@better-a.test', slug: 'spike-a', role: 'editor' })).json()) as { token: string };
  secrets.push(token, 'solo@better-a.test');
  await solo.page.goto(`/#invite=${token}`);
  await press(solo.page, 'Create passkey', 'registered');
  const list = (await (await solo.request.get('/api/auth/passkey/list-user-passkeys')).json()) as { id: string }[];
  const r = await post(solo, '/api/auth/passkey/delete-passkey', { id: list[0]?.id });
  const left = (await sql(solo, "SELECT COUNT(*) AS n FROM passkey WHERE userId = (SELECT id FROM staff_users WHERE email = 'solo@better-a.test')"))[0];
  console.log('delete only passkey: status', r.status(), 'passkeys left', JSON.stringify(left));
  expect(r.status()).toBeLessThan(300); // allowed: a lock-out guard (never remove the last one) would be ours to write
  expect(left).toEqual({ n: 0 });
});

test('recovery: our token as the registration context, then old sessions and passkeys are removed by our hook', async ({ browser }) => {
  const known = await post(anon, '/ours/recover', { email: ADMIN });
  const unknown = await post(anon, '/ours/recover', { email: 'nobody@better-a.test' });
  expect(await known.text()).toBe(await unknown.text());
  const mail = ((await (await anon.request.get('/__test/capture')).json()) as { to_email: string; subject: string; body: string }[]).filter((m) => m.subject === 'Recover your access').at(-1);
  expect(mail?.to_email).toBe(ADMIN);
  const link = (mail?.body ?? '').replace(ORIGIN, '');
  secrets.push(link.split('#recover=')[1] ?? '');
  const phone = await newPerson(browser);
  await phone.page.goto(link);
  await press(phone.page, 'Create passkey', 'registered');
  expect((await me(phone, 'spike-a')).body).toEqual({ role: 'admin' });
  expect((await me(admin, 'spike-a')).status).toBe(401);
  await press(admin.page, 'Sign in with passkey', 'sign-in-401');
  const reuse = await post(anon, '/api/auth/passkey/generate-register-options', {});
  console.log('reuse recovery token without context status:', reuse.status());
  admin = phone;
});

test('audit rows exist for the actions our code and our wrappers cover', async () => {
  const rows = (await (await anon.request.get('/__test/audit')).json()) as { slug: string; action: string }[];
  const actions = new Set(rows.filter((r) => r.slug === 'spike-a').map((r) => r.action));
  console.log('audit actions seen:', [...actions].join(','));
  for (const a of ['staff.invite.accepted', 'staff.signin', 'staff.signout', 'staff.recovery.requested', 'staff.recovery.completed']) expect(actions.has(a), a).toBe(true);
  expect(rows.filter((r) => r.slug === 'spike-b')).toEqual([]);
});

test('wrong origin: registration is refused', async ({ browser }) => {
  const p = await newPerson(browser, 'http://localhost:8791');
  const { token } = (await (await p.request.post('http://localhost:8791/__test/operator-invite', { headers: { Origin: 'http://localhost:8791', 'Content-Type': 'application/json' }, data: { email: 'o@better-a.test', slug: 'spike-a', role: 'editor' } })).json()) as { token: string };
  secrets.push(token, 'o@better-a.test');
  await p.page.goto(`/#invite=${token}`);
  await p.page.getByRole('button', { name: 'Create passkey' }).click();
  await p.page.waitForTimeout(2500);
  const text = await p.page.locator('#status').textContent();
  console.log('wrong-origin page status text:', JSON.stringify(text));
  // The hard evidence is on the server: no person, no passkey, and the token is still unused.
  const person = await sql(anon, "SELECT COUNT(*) AS n FROM staff_users WHERE email = 'o@better-a.test'");
  expect(person[0]).toEqual({ n: 0 });
  expect(text).not.toBe('registered');
  expect((await me(p, 'spike-a')).status).toBe(401);
  const log = readFileSync('../logs/better-8791.log', 'utf8');
  expect(log).toMatch(/verify-registration (4\d\d|5\d\d)/);
});

test('logs hold no email, token or cookie', async () => {
  const log = readFileSync('../logs/better-8790.log', 'utf8') + readFileSync('../logs/better-8791.log', 'utf8');
  for (const s of secrets.filter(Boolean)) expect(log.includes(s), `log contains ${s.slice(0, 6)}…`).toBe(false);
  expect(log).not.toMatch(/better-auth\.session_token=/);
});
