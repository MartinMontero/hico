import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

// Staff sign-in in the real console, with Chromium's virtual authenticator (D-26). The server-side rules
// are in tests/worker; this file proves the ceremonies and the screens at 360 px and by keyboard.
const ORIGIN = 'http://localhost:4173';
test.describe.configure({ mode: 'serial' });

interface Person { context: BrowserContext; page: Page; request: APIRequestContext; cdp: Awaited<ReturnType<BrowserContext['newCDPSession']>>; authenticators: string[] }
const AUTHENTICATOR = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const;

async function newPerson(browser: Browser): Promise<Person> {
  const context = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 360, height: 740 }, locale: 'en-CA' });
  const page = await context.newPage();
  await page.goto('/staff');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTHENTICATOR });
  return { context, page, request: context.request, cdp, authenticators: [authenticatorId] };
}

const post = (p: Person, path: string, data: unknown = {}) => p.request.post(path, { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data });
const link = (name: string) => (process.env[name] ?? '').replace('http://localhost:4173', '');

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe on ${label}`).toEqual([]);
  console.log(`axe ${label}: ${results.violations.length} violation(s), 0 serious or critical`);
}

async function noSideScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

let admin: Person;
let editor: Person;

test('a signed-out visitor sees the sign-in screen, axe-clean at 360 px', async ({ browser }) => {
  const p = await newPerson(browser);
  await expect(p.page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible();
  await expect(p.page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
  await expect(p.page.getByText('Lost your device? Ask another admin')).toBeVisible();
  await axe(p.page, 'staff sign-in');
  await noSideScroll(p.page);
  await p.context.close();
});

test('a link with nothing after the # sign, and a made-up link, explain themselves', async ({ browser }) => {
  const p = await newPerson(browser);
  await p.page.goto('/staff/accept');
  await expect(p.page.getByText('Open the link you were given')).toBeVisible();
  await p.page.goto(`/staff/accept#invite=${'A'.repeat(43)}`);
  await expect(p.page.getByText('This link is not valid any more')).toBeVisible();
  await axe(p.page, 'invalid link');
  await p.context.close();
});

test('first admin: the invite link creates a passkey, signs in, and leaves the address bar', async ({ browser }) => {
  admin = await newPerson(browser);
  await admin.page.goto(link('E2E_WHISTLER_ADMIN_LINK'));
  await expect(admin.page.getByText('You are invited, Whistler Admin')).toBeVisible();
  await axe(admin.page, 'accept invite');
  await admin.page.getByLabel('Name this passkey').fill('Laptop');
  await admin.page.getByRole('button', { name: 'Create my passkey' }).click();
  await expect(admin.page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  expect(admin.page.url()).not.toContain('#');
  expect(admin.page.url()).not.toContain('invite=');
  await expect(admin.page.getByRole('link', { name: 'Whistler' })).toBeVisible();
  await expect(admin.page.getByText('Admin', { exact: true })).toBeVisible();
  await expect(admin.page.getByRole('note')).toContainText('only one passkey'); // the second-passkey nudge
  await axe(admin.page, 'staff home');
  await noSideScroll(admin.page);
  const cookie = (await admin.context.cookies()).find((c) => c.name === 'hc_staff');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: true });
  // The link was used up.
  const again = await admin.request.post('/api/staff/auth/link/inspect', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data: { token: link('E2E_WHISTLER_ADMIN_LINK').split('=')[1] } });
  expect(again.status()).toBe(400);
});

test('sign out moves focus to the sign-in heading; the passkey signs back in with no username, by keyboard alone', async () => {
  await admin.page.getByRole('button', { name: 'Sign out' }).click();
  await expect(admin.page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeFocused(); // focus is not lost with the screen
  expect((await admin.request.get('/api/staff/auth/me')).status()).toBe(401);
  await admin.page.keyboard.press('Tab');
  await expect(admin.page.getByRole('button', { name: 'Sign in with a passkey' })).toBeFocused();
  await admin.page.keyboard.press('Enter');
  await expect(admin.page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  expect((await admin.request.get('/api/staff/auth/me')).status()).toBe(200);
});

test('a fresh visit tabs through the skip link, Settings and the sign-in button in that order', async ({ browser }) => {
  const p = await newPerson(browser);
  await expect(p.page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible(); // the chunk has loaded
  await p.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const order: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await p.page.keyboard.press('Tab');
    order.push(await p.page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim()));
  }
  expect(order).toEqual(['Skip to content', 'Settings', 'Sign in with a passkey']);
  await p.context.close();
});
test('my account: sessions, a second passkey, and the dialogs for removing one', async () => {
  await admin.page.getByRole('link', { name: 'My account' }).click();
  await expect(admin.page.getByRole('heading', { level: 1, name: 'My account' })).toBeFocused();
  await expect(admin.page.getByText('This device.')).toBeVisible();
  await axe(admin.page, 'my account');
  // Only one passkey: removing it is refused with a plain message.
  await admin.page.getByRole('button', { name: 'Remove Laptop' }).click();
  const dialog = admin.page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Yes' }).click();
  await expect(admin.page.getByRole('alert')).toContainText('You cannot remove your only passkey');
  // Add a second one on a security key (Chrome allows one internal authenticator).
  const key = await admin.cdp.send('WebAuthn.addVirtualAuthenticator', { options: { ...AUTHENTICATOR, transport: 'usb' } });
  admin.authenticators.push(key.authenticatorId);
  await admin.page.getByLabel('Name this passkey').fill('Security key');
  await admin.page.getByRole('button', { name: 'Add another passkey' }).click();
  await expect(admin.page.locator('strong', { hasText: 'Security key' })).toBeVisible();
  await expect(admin.page.getByRole('status').filter({ hasText: 'Passkey added' })).toBeVisible();
  // The dialog returns focus to the button that opened it, and Escape closes it.
  const removeKey = admin.page.getByRole('button', { name: 'Remove Security key' });
  await removeKey.focus();
  await admin.page.keyboard.press('Enter');
  await expect(admin.page.getByRole('dialog')).toBeVisible();
  await admin.page.keyboard.press('Escape');
  await expect(admin.page.getByRole('dialog')).toBeHidden();
  await expect(removeKey).toBeFocused();
  await axe(admin.page, 'my account with two passkeys');
  // Back home, the nudge is gone.
  await admin.page.getByRole('link', { name: 'Back' }).click();
  await expect(admin.page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  await expect(admin.page.getByRole('note')).toHaveCount(0);
});

test('an invited editor registers on their own device and is limited to editor rights', async ({ browser }) => {
  const res = await post(admin, '/api/staff/p/demo-whistler/people/invite', { email: 'editor@whistler.e2e.test', displayName: 'Whistler Editor', role: 'editor' });
  expect(res.status()).toBe(200);
  const { token } = (await res.json()) as { token: string };
  editor = await newPerson(browser);
  await editor.page.goto(`/staff/accept#invite=${token}`);
  await editor.page.getByRole('button', { name: 'Create my passkey' }).click();
  await expect(editor.page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  await expect(editor.page.getByText('Editor', { exact: true })).toBeVisible();
  expect((await editor.request.get('/api/staff/p/demo-whistler/people')).status()).toBe(403);
  expect((await editor.request.get('/api/staff/p/vancouver-downtown/people')).status()).toBe(404); // a role elsewhere does not exist
  expect((await admin.request.get('/api/staff/p/demo-whistler/people')).status()).toBe(200);
});

test('recovery: an admin hands over a link, the new device works and the old sessions and passkeys stop', async ({ browser }) => {
  const people = (await (await admin.request.get('/api/staff/p/demo-whistler/people')).json()) as { id: string; email: string }[];
  const target = people.find((p) => p.email === 'editor@whistler.e2e.test');
  const res = await post(admin, `/api/staff/p/demo-whistler/people/${target?.id}/recovery`);
  expect(res.status()).toBe(200);
  const { token } = (await res.json()) as { token: string };
  const phone = await newPerson(browser);
  await phone.page.goto(`/staff/accept#recover=${token}`);
  await expect(phone.page.getByText('Every earlier passkey and sign-in stops working')).toBeVisible();
  await phone.page.getByRole('button', { name: 'Create my passkey' }).click();
  await expect(phone.page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  expect((await editor.request.get('/api/staff/auth/me')).status()).toBe(401); // the old session is gone
  await editor.page.goto('/staff');
  await editor.page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(editor.page.getByRole('alert')).toContainText('That did not work'); // the old passkey is revoked
  expect((await phone.request.get('/api/staff/auth/me')).status()).toBe(200);
  const again = await phone.request.post('/api/staff/auth/link/inspect', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data: { token } });
  expect(again.status()).toBe(400); // single use
});

test('French: the staff screens follow the language choice', async () => {
  await admin.page.goto('/staff');
  await admin.page.getByRole('button', { name: 'Settings' }).click();
  await admin.page.getByRole('radio', { name: 'Français' }).check();
  await admin.page.keyboard.press('Escape');
  await expect(admin.page.getByRole('heading', { level: 1, name: 'Vos auberges' })).toBeVisible();
  await expect(admin.page.getByRole('link', { name: 'Mon compte' })).toBeVisible();
  await axe(admin.page, 'staff home (French)');
});
