import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// The staff console in a real browser at 360 px, with a virtual authenticator: every screen axe-clean, the
// main flows done by keyboard, the conflict screen, QR codes, export, French, and hostile text rendered as text.
// Server-side rules (roles, versions, isolation, audit) are in tests/worker; this proves the screens.
const ORIGIN = 'http://localhost:4173';
const SLUG = 'vancouver-downtown';
test.describe.configure({ mode: 'serial' });

const AUTHENTICATOR = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const;
const link = (name: string) => (process.env[name] ?? '').replace(ORIGIN, '');

let context: BrowserContext;
let page: Page;

async function axe(label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe on ${label}`).toEqual([]);
  console.log(`axe ${label}: ${results.violations.length} violation(s), 0 serious or critical`);
}

// Screenshots for the walkthrough (docs\walkthrough-phase-1b-2.md): only when HICO_SCREENSHOTS=1, so a normal run changes no files.
async function shot(name: string) {
  if (process.env['HICO_SCREENSHOTS'] === '1') await page.screenshot({ path: `docs/screenshots/phase-1b-2/${name}.png` });
}

async function noSideScroll() {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

async function goSection(name: string, heading: string) {
  const nav = page.getByRole('navigation', { name: 'This hostel' });
  await nav.getByRole('button', { name: /^Menu/ }).click();
  await nav.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeFocused();
  await expect(nav.getByRole('link', { name, exact: true })).toBeHidden(); // the menu closed
}

const send = (path: string, data: unknown) => context.request.post(`/api/staff/p/${SLUG}${path}`, { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 360, height: 740 }, locale: 'en-CA', acceptDownloads: true });
  page = await context.newPage();
  await page.goto('/staff');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTHENTICATOR });
});
test.afterAll(async () => {
  await context.close();
});

test('sign in with the invite, open the hostel, and the overview is axe-clean at 360 px', async () => {
  await page.goto(link('E2E_DOWNTOWN_ADMIN_LINK'));
  await page.getByRole('button', { name: 'Create my passkey' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your hostels' })).toBeVisible();
  await page.getByRole('link', { name: 'Vancouver Downtown' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Menu: Overview' })).toBeVisible();
  await expect(page.getByText('What needs your attention today')).toBeVisible();
  await axe('console overview');
  await shot('01-overview');
  // The menu: closed at first, opens from its button, Escape closes it and returns focus to the button.
  const toggle = page.getByRole('button', { name: 'Menu: Overview' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.getByRole('link', { name: 'Board', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Board', exact: true })).toBeHidden();
  await expect(toggle).toBeFocused();
  await noSideScroll();
});

test('board: add an activity, see the check line, and every control has a name', async () => {
  await goSection('Board', 'Board');
  await axe('board');
  await shot('02-board');
  await noSideScroll();
  await page.getByRole('button', { name: 'Add an activity' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an activity' });
  await expect(dialog).toBeVisible();
  await axe('activity form');
  await shot('03-activity-form');
  await dialog.getByLabel('Title (English)').fill('E2E Trivia');
  await dialog.getByLabel('Description (English)').fill('Bring a friend');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await expect(dialog).toBeHidden();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'E2E Trivia' }) });
  await expect(card).toContainText('Every Monday, 19:00');
  await expect(card).toContainText('by Fawzie Both');
  await noSideScroll();
});

test('two people editing: the second save gets the conflict screen, and keeps its choice', async () => {
  await page.getByRole('button', { name: 'Edit E2E Trivia' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit the activity' });
  await dialog.getByLabel('Title (English)').fill('E2E Trivia, my version');
  // Meanwhile someone else saves.
  const list = (await (await context.request.get(`/api/staff/p/${SLUG}/activities`)).json()) as { id: string; title: { en: string }; version: number }[];
  const theirs = list.find((a) => a.title.en === 'E2E Trivia');
  expect(theirs).toBeTruthy();
  const res = await send(`/activities/${theirs?.id}`, {
    titleEn: 'E2E Trivia, their version', titleFr: '', descriptionEn: 'Bring a friend', descriptionFr: '', category: 'social', zoneId: null, hostLabel: '', capacity: null,
    schedule: { kind: 'weekly', weekday: 1, startLocal: '19:00', endLocal: null }, version: theirs?.version,
  });
  expect(res.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Save' }).click();
  const conflict = page.getByRole('dialog', { name: 'Someone saved first' });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText('E2E Trivia, my version');
  await expect(conflict).toContainText('E2E Trivia, their version');
  await axe('conflict screen');
  await shot('04-conflict');
  await conflict.getByRole('button', { name: 'Save mine over theirs' }).click();
  await page.getByRole('dialog', { name: 'Edit the activity' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Trivia, my version' })).toBeVisible();
});

test('cancel one date: the dialog works, Escape closes it and focus returns to the button', async () => {
  const opener = page.getByRole('button', { name: 'Cancel a date E2E Trivia, my version' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Cancel a single date' });
  await dialog.getByLabel('Date to cancel').fill('2030-01-07');
  await dialog.getByRole('button', { name: 'Cancel this date' }).click();
  await expect(dialog.getByText('Monday, January 7, 2030').first()).toBeVisible();
  await axe('cancel a date');
  await dialog.getByRole('button', { name: 'Bring back' }).click();
  await expect(dialog.getByText('No dates are cancelled.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('a shared activity: the owner sees where it shows and cannot add a hostel they do not work at', async () => {
  const shared = page.getByRole('listitem').filter({ hasText: 'Shared with 2 hostels' }).first();
  await shared.getByRole('button', { name: /^Where it shows/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Where it shows' });
  await expect(dialog).toContainText('Vancouver Jericho Beach');
  await expect(dialog.getByRole('button', { name: /Stop showing here/ })).toBeVisible();
  await expect(dialog).toContainText('There is no other hostel where you also work.');
  await axe('where it shows');
  await shot('05-where-it-shows');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('keyboard only: open the form, type, submit with Enter, and focus comes back to the button', async () => {
  const add = page.getByRole('button', { name: 'Add an activity' });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Title (English)')).toBeFocused(); // focus moves into the dialog
  await page.keyboard.type('Keyboard quiz');
  await page.keyboard.press('Enter'); // a text field submits its form
  await expect(page.getByRole('heading', { name: 'Keyboard quiz' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(add).toBeFocused();
  // Tab never leaves an open dialog.
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('hostile text is shown as text and runs nothing', async () => {
  await page.getByRole('button', { name: 'Add an activity' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title (English)').fill('<img src=x onerror="window.__xss=1">');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: '<img src=x onerror="window.__xss=1">' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test('places and offers: add, mark as still correct', async () => {
  await goSection('Places', 'Places');
  await page.getByRole('button', { name: 'Add a place' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a place' });
  await dialog.getByLabel('Name', { exact: true }).fill('E2E Cafe');
  await dialog.getByLabel('Note (English)').fill('Good coffee');
  await axe('place form');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Still correct E2E Cafe' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Marked as checked today.' })).toBeVisible();
  await axe('places');
  await shot('06-places');
  await goSection('Offers', 'Offers');
  await page.getByRole('button', { name: 'Add an offer' }).click();
  const offer = page.getByRole('dialog', { name: 'Add an offer' });
  await offer.getByLabel('Partner name').fill('E2E Rafting');
  await offer.getByLabel('The offer (English)').fill('10% off');
  await offer.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Rafting' })).toBeVisible();
  await expect(page.getByText('Guests can see it').first()).toBeVisible();
  await axe('offers');
});

test('zones, translations, QR labels (with the QR code), and switches', async () => {
  await goSection('Zones', 'Zones');
  await page.getByRole('button', { name: 'Add a zone' }).click();
  const zone = page.getByRole('dialog', { name: 'Add a zone' });
  await zone.getByLabel('Name (English)').fill('E2E Deck');
  await zone.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Deck' })).toBeVisible();
  await axe('zones');

  await goSection('Translations', 'Translations');
  await expect(page.getByRole('heading', { name: 'E2E Cafe' })).toBeVisible(); // English note, no French
  await axe('translations');

  await goSection('QR codes', 'QR codes');
  await page.getByLabel('Label', { exact: true }).fill('front-desk');
  await page.getByRole('button', { name: 'Add a label' }).click();
  await expect(page.getByRole('heading', { name: 'front-desk' })).toBeVisible();
  await expect(page.getByText('arrive in Stage 2')).toBeVisible();
  await axe('QR codes');
  await page.getByRole('button', { name: 'Show QR code front-desk' }).click();
  const qr = page.getByRole('dialog', { name: 'QR code: front-desk' });
  const img = qr.getByRole('img', { name: /labelled front-desk/ });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0); // the SVG decoded
  await expect(qr).toContainText(`/p/${SLUG}#l=front-desk`);
  await axe('QR code');
  await shot('07-qr-code');
  await page.keyboard.press('Escape');

  await goSection('Switches', 'Switches');
  await page.getByLabel('Common Room').check();
  await expect(page.getByRole('status').filter({ hasText: 'Common Room is on.' })).toBeVisible();
  await axe('switches');
});

test('people: an invite link with its QR code, shown once; then the audit log and the export', async () => {
  await goSection('People', 'People');
  await page.getByLabel('Name', { exact: true }).fill('New Person');
  await page.getByLabel('Email').fill('new.person@e2e.test');
  await page.getByRole('button', { name: 'Create a link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Link for New Person' });
  await expect(dialog.getByLabel('The link')).toHaveValue(/\/staff\/accept#invite=[A-Za-z0-9_-]{43}$/);
  await expect(dialog.getByRole('img', { name: 'QR code of the link below' })).toBeVisible();
  await axe('invite link');
  await shot('08-invite-link');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Fawzie Both' })).toBeVisible(); // a person joins the list when they use the link, not before
  await axe('people');

  await goSection('Audit log', 'Audit log');
  await expect(page.getByText('Activity added').first()).toBeVisible();
  await expect(page.getByText('Invite link created').first()).toBeVisible();
  await axe('audit log');
  await shot('09-audit-log');

  await goSection('Export', 'Export');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the export' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^vancouver-downtown-export-\d{4}-\d{2}-\d{2}\.json$/);
  await axe('export');
});

test('French: the console follows the language, and the screens still fit', async () => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Français' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: 'Exportation' })).toBeVisible();
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('navigation', { name: 'Cette auberge' }).getByRole('link', { name: 'Tableau', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Ajouter une activité' })).toBeVisible();
  await axe('board (French)');
  await shot('10-board-french');
  await noSideScroll();
});

test('an editor sees no admin sections and the server agrees', async ({ browser }) => {
  // Hand a link to an editor through the API as the admin, then use it in a second browser.
  const res = await send('/people/invite', { email: 'editor@downtown.e2e.test', displayName: 'Downtown Editor', role: 'editor' });
  const { token } = (await res.json()) as { token: string };
  const ctx2 = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 360, height: 740 }, locale: 'en-CA' });
  const p2 = await ctx2.newPage();
  await p2.goto('/staff');
  const cdp = await ctx2.newCDPSession(p2);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTHENTICATOR });
  await p2.goto(`/staff/accept#invite=${token}`);
  await p2.getByRole('button', { name: 'Create my passkey' }).click();
  await p2.getByRole('link', { name: 'Vancouver Downtown' }).click();
  await p2.getByRole('button', { name: /^Menu/ }).click();
  const nav = p2.getByRole('navigation', { name: 'This hostel' });
  await expect(nav.getByRole('link', { name: 'Board', exact: true })).toBeVisible();
  for (const hidden of ['People', 'Audit log', 'Export']) await expect(nav.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
  await p2.goto(`/staff/p/${SLUG}/people`);
  await expect(p2.getByText('Your role does not allow this')).toBeVisible();
  await p2.goto(`/staff/p/${SLUG}/zones`);
  await expect(p2.getByRole('button', { name: 'Add a zone' })).toHaveCount(0);
  await expect(p2.getByText('Only an admin can change this.')).toBeVisible();
  await ctx2.close();
});
