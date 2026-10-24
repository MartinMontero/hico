import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

// SPIKE Route 3: our own WebAuthn + D1 sessions, proven with Chromium's virtual authenticator.
const ORIGIN = 'http://localhost:8788';
test.describe.configure({ mode: 'serial' });

type Cdp = Awaited<ReturnType<BrowserContext['newCDPSession']>>;
interface Person { context: BrowserContext; page: Page; request: APIRequestContext; cdp: Cdp; authenticators: string[] }

const AUTHENTICATOR = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const;

async function newPerson(browser: Browser, baseURL = ORIGIN): Promise<Person> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/'); // any page on the origin first, so the CDP session targets it
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTHENTICATOR });
  return { context, page, request: context.request, cdp, authenticators: [authenticatorId] };
}

const headers = (origin = ORIGIN) => ({ Origin: origin, 'Content-Type': 'application/json' });
// `origin` is the Origin header the request claims; the URL always stays on the local server.
const post = (p: Person, path: string, data: unknown = {}, origin = ORIGIN) => p.request.post(path, { headers: headers(origin), data });
const me = async (p: Person, slug: string) => {
  const r = await p.request.get(`/staff/p/${slug}/me`);
  return { status: r.status(), body: await r.json().catch(() => null) };
};
const operatorInvite = async (p: Person, email: string, slug: string, role: 'editor' | 'admin') =>
  ((await (await post(p, '/__test/operator-invite', { email, slug, role })).json()) as { token: string }).token;
const sql = async (p: Person, statement: string, params: unknown[] = []) =>
  (await (await post(p, '/__test/sql', { sql: statement, params })).json()) as Record<string, unknown>[];
const capture = async (p: Person) => (await (await p.request.get('/__test/capture')).json()) as { to_email: string; subject: string; body: string }[];

async function press(p: Page, name: string, expected: string): Promise<void> {
  await p.locator('#status').evaluate((el) => { el.textContent = ''; }); // a stale result must not satisfy the wait
  await p.getByRole('button', { name }).click();
  await expect(p.locator('#status')).toHaveText(expected);
}

const secrets: string[] = []; // every token and email the run produced, checked against the logs at the end
let admin: Person, editor: Person, anon: Person;
const ADMIN = 'admin@spike-a.test';
const EDITOR = 'editor@spike-a.test';

test.beforeAll(async ({ browser }) => {
  anon = await newPerson(browser);
  await post(anon, '/__test/seed');
});

test('invite then first passkey: registers, signs in, and is limited to its own property', async ({ browser }) => {
  admin = await newPerson(browser);
  const token = await operatorInvite(admin, ADMIN, 'spike-a', 'admin');
  secrets.push(token, ADMIN);
  await admin.page.goto(`/#invite=${token}`);
  await admin.page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(admin.page.locator('#status')).toHaveText('registered');
  expect(admin.page.url()).not.toContain(token); // the token left the address bar
  expect(await me(admin, 'spike-a')).toEqual({ status: 200, body: { role: 'admin' } });
  expect((await me(admin, 'spike-b')).status).toBe(404); // naming B gives nothing
  expect((await me(anon, 'spike-a')).status).toBe(401);
  const cookies = await admin.context.cookies();
  const c = cookies.find((x) => x.name === 'spike_staff');
  expect(c?.httpOnly).toBe(true);
  expect(c?.sameSite).toBe('Lax');
  expect(c?.secure).toBe(true);
});

test('sign out revokes at once; the passkey signs back in with no username', async () => {
  await press(admin.page, 'Sign out', 'signed-out');
  expect((await me(admin, 'spike-a')).status).toBe(401);
  await press(admin.page, 'Sign in with passkey', 'signed-in');
  expect((await me(admin, 'spike-a')).body).toEqual({ role: 'admin' });
});

test('an admin invites an editor; the editor cannot invite; an admin of A cannot invite into B', async ({ browser }) => {
  expect((await post(admin, '/auth/invite', { slug: 'spike-a', email: EDITOR, role: 'editor' })).status()).toBe(200);
  const mail = (await capture(admin)).at(-1);
  expect(mail?.to_email).toBe(EDITOR);
  const link = mail?.body ?? '';
  secrets.push(link.split('#invite=')[1] ?? '', EDITOR);
  editor = await newPerson(browser);
  await editor.page.goto(link.replace(ORIGIN, ''));
  await editor.page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(editor.page.locator('#status')).toHaveText('registered');
  expect((await me(editor, 'spike-a')).body).toEqual({ role: 'editor' });
  expect((await post(editor, '/auth/invite', { slug: 'spike-a', email: 'x@spike-a.test', role: 'editor' })).status()).toBe(403);
  expect((await post(admin, '/auth/invite', { slug: 'spike-b', email: 'x@spike-b.test', role: 'admin' })).status()).toBe(403);
  expect((await post(anon, '/auth/invite', { slug: 'spike-a', email: 'x@spike-a.test', role: 'editor' })).status()).toBe(401);
});

test('roles are read from the database on every request', async () => {
  await sql(admin, "UPDATE staff_memberships SET role = 'admin' WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?1)", [EDITOR]);
  expect((await me(editor, 'spike-a')).body).toEqual({ role: 'admin' });
  await sql(admin, "UPDATE staff_memberships SET role = 'editor' WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?1)", [EDITOR]);
  expect((await me(editor, 'spike-a')).body).toEqual({ role: 'editor' });
  await sql(admin, 'DELETE FROM staff_memberships WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?1)', [EDITOR]);
  expect((await me(editor, 'spike-a')).status).toBe(404); // signed in, but no role here
  await sql(admin, "INSERT INTO staff_memberships (staff_user_id, property_id, role) SELECT u.id, p.id, 'editor' FROM staff_users u, properties p WHERE u.email = ?1 AND p.slug = 'spike-a'", [EDITOR]);
  expect((await me(editor, 'spike-a')).status).toBe(200);
  await sql(admin, "UPDATE staff_users SET disabled_at = 5 WHERE email = ?1", [EDITOR]);
  expect((await me(editor, 'spike-a')).status).toBe(401); // a disabled person's session stops at once
  await sql(admin, 'UPDATE staff_users SET disabled_at = NULL WHERE email = ?1', [EDITOR]);
});

test('sessions: list, revoke one, sign out everywhere', async () => {
  await press(admin.page, 'Sign in with passkey', 'signed-in'); // a second session
  const list = (await (await admin.request.get('/auth/sessions')).json()) as { handle: string; current: boolean }[];
  expect(list.length).toBe(2);
  const other = list.find((s) => !s.current);
  expect((await (await post(admin, '/auth/sessions/revoke', { handle: other?.handle })).json())).toEqual({ revoked: 1 });
  expect(((await (await admin.request.get('/auth/sessions')).json()) as unknown[]).length).toBe(1);
  expect((await post(admin, '/auth/logout-all')).status()).toBe(200);
  expect((await me(admin, 'spike-a')).status).toBe(401);
  await press(admin.page, 'Sign in with passkey', 'signed-in');
});

test('a second passkey can be added; a revoked passkey cannot sign in; the last one cannot be removed', async () => {
  // The same authenticator cannot register twice for one person (excludeCredentials), so a second device is added.
  // Chrome allows one internal authenticator, so the second device is a security key.
  const key = await admin.cdp.send('WebAuthn.addVirtualAuthenticator', { options: { ...AUTHENTICATOR, transport: 'usb' } });
  admin.authenticators.push(key.authenticatorId);
  const added = await admin.page.evaluate(() => (window as never as { spikeAuth: { register: (l: string, f: boolean) => Promise<string> } }).spikeAuth.register('second', false));
  expect(added).toBe('registered');
  const creds = (await (await admin.request.get('/auth/credentials')).json()) as { id: string }[];
  expect(creds.length).toBe(2);
  // Take an assertion, revoke the credential it used, then present it: refused.
  const parts = await admin.page.evaluate(() => (window as never as { spikeAuth: { loginParts: () => Promise<{ challengeId: string; response: { id: string } }> } }).spikeAuth.loginParts());
  secrets.push(parts.response.id);
  expect((await (await post(admin, '/auth/credentials/revoke', { id: parts.response.id })).json())).toEqual({ revoked: 1 });
  expect((await post(anon, '/auth/login/verify', parts)).status()).toBe(401);
  // The device holding the revoked passkey is now lost: remove it, so later sign-ins use the one left.
  for (const id of admin.authenticators) {
    const { credentials } = await admin.cdp.send('WebAuthn.getCredentials', { authenticatorId: id });
    if (credentials.some((c) => c.credentialId.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') === parts.response.id)) {
      await admin.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: id });
      admin.authenticators = admin.authenticators.filter((x) => x !== id);
    }
  }
  const rest = (await (await admin.request.get('/auth/credentials')).json()) as { id: string }[];
  expect(rest.length).toBe(1);
  expect((await post(admin, '/auth/credentials/revoke', { id: rest[0]?.id })).status()).toBe(409);
});

test('a counter that goes backwards (a cloned authenticator) is refused', async () => {
  const parts = await admin.page.evaluate(() => (window as never as { spikeAuth: { loginParts: () => Promise<{ challengeId: string; response: { id: string } }> } }).spikeAuth.loginParts());
  await sql(admin, 'UPDATE staff_credentials SET counter = 100000 WHERE id = ?1', [parts.response.id]);
  expect((await post(anon, '/auth/login/verify', parts)).status()).toBe(401);
  await sql(admin, 'UPDATE staff_credentials SET counter = 0 WHERE id = ?1', [parts.response.id]);
});

test('an assertion cannot be replayed (challenges are single use) and a challenge cannot be reused for another kind', async () => {
  const parts = await admin.page.evaluate(() => (window as never as { spikeAuth: { loginParts: () => Promise<{ challengeId: string; response: { id: string } }> } }).spikeAuth.loginParts());
  expect((await post(anon, '/auth/login/verify', parts)).status()).toBe(200);
  expect((await post(anon, '/auth/login/verify', parts)).status()).toBe(401);
  expect((await post(anon, '/auth/register/verify', { challengeId: parts.challengeId, response: parts.response })).status()).toBe(400);
});

test('an expired invite and a used invite are refused', async ({ browser }) => {
  const p = await newPerson(browser);
  const expired = await operatorInvite(p, 'late@spike-a.test', 'spike-a', 'editor');
  secrets.push(expired, 'late@spike-a.test');
  await sql(p, "UPDATE staff_tokens SET expires_at = 1 WHERE email = 'late@spike-a.test'");
  expect((await post(p, '/auth/register/options', { token: expired })).status()).toBe(400);
  const once = await operatorInvite(p, 'once@spike-a.test', 'spike-a', 'editor');
  secrets.push(once, 'once@spike-a.test');
  await p.page.goto(`/#invite=${once}`);
  await p.page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(p.page.locator('#status')).toHaveText('registered');
  expect((await post(anon, '/auth/register/options', { token: once })).status()).toBe(400); // already used
  expect((await post(anon, '/auth/register/options', { token: 'not-a-token' })).status()).toBe(400);
});

test('recovery on a new device: link by email, old sessions and passkeys die, and the answer never reveals who exists', async ({ browser }) => {
  const known = await post(anon, '/auth/recover', { email: ADMIN });
  const unknown = await post(anon, '/auth/recover', { email: 'nobody@spike-a.test' });
  expect(known.status()).toBe(200);
  expect(await known.text()).toBe(await unknown.text());
  const mail = (await capture(anon)).filter((m) => m.subject === 'Recover your access').at(-1);
  expect(mail?.to_email).toBe(ADMIN);
  expect((await capture(anon)).some((m) => m.to_email === 'nobody@spike-a.test')).toBe(false);
  const link = (mail?.body ?? '').replace(ORIGIN, '');
  secrets.push(link.split('#recover=')[1] ?? '');
  const phone = await newPerson(browser); // a different authenticator: the old one is "lost"
  await phone.page.goto(link);
  await phone.page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(phone.page.locator('#status')).toHaveText('registered');
  expect((await me(phone, 'spike-a')).body).toEqual({ role: 'admin' });
  expect((await me(admin, 'spike-a')).status).toBe(401); // the old session is gone
  await press(admin.page, 'Sign in with passkey', 'sign-in-401'); // the old passkey is revoked
  expect((await post(anon, '/auth/register/options', { token: link.split('#recover=')[1] })).status()).toBe(400); // single use
  admin = phone;
});

test('every action left an audit row under the right property, and none under the other', async () => {
  const rows = (await (await anon.request.get('/__test/audit')).json()) as { slug: string; action: string }[];
  const actions = new Set(rows.filter((r) => r.slug === 'spike-a').map((r) => r.action));
  for (const a of ['staff.invite.created', 'staff.invite.accepted', 'staff.signin', 'staff.signout', 'staff.signout_all', 'staff.session.revoked', 'staff.credential.added', 'staff.credential.revoked', 'staff.recovery.requested', 'staff.recovery.completed']) {
    expect(actions.has(a), a).toBe(true);
  }
  expect(rows.filter((r) => r.slug === 'spike-b')).toEqual([]);
});

test('writes need a matching Origin and JSON', async () => {
  expect((await post(admin, '/auth/logout', {}, 'http://evil.example')).status()).toBe(403);
  const plain = await admin.request.post('/auth/logout', { headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, data: 'x' });
  expect(plain.status()).toBe(415);
  expect((await me(admin, 'spike-a')).status).toBe(200); // neither request signed anyone out
});

test('wrong origin: a server that expects another origin refuses both registration and sign-in', async ({ browser }) => {
  const p = await newPerson(browser, 'http://localhost:8789');
  const token = await operatorInvite(p, 'origin@spike-a.test', 'spike-a', 'editor');
  secrets.push(token, 'origin@spike-a.test');
  await p.page.goto(`/#invite=${token}`);
  await p.page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(p.page.locator('#status')).toHaveText('register-400');
  const parts = await admin.page.evaluate(() => (window as never as { spikeAuth: { loginParts: () => Promise<unknown> } }).spikeAuth.loginParts());
  const r = await p.request.post('http://localhost:8789/auth/login/verify', { headers: { Origin: 'http://localhost:8789', 'Content-Type': 'application/json' }, data: parts });
  expect(r.status()).toBe(401);
});

test('logs hold no email, token, credential id or cookie', async () => {
  const log = readFileSync('../logs/own-8788.log', 'utf8') + readFileSync('../logs/own-8789.log', 'utf8');
  expect(log.length).toBeGreaterThan(200);
  for (const s of secrets.filter(Boolean)) expect(log.includes(s), `log contains ${s.slice(0, 6)}…`).toBe(false);
  expect(log).not.toMatch(/spike_staff=/);
  expect(log).not.toMatch(/@spike-a\.test/);
});
