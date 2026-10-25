import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { runSql } from '../../scripts/operator-lib.ts';

// The Stage 0 guest app at 360 px (Phase 2 item 12): first visit, a labelled QR link, language switch, offline reload and
// delete my data, plus axe on every screen and state and a keyboard walk. Server rules are tested in tests/worker and
// tests/web; this proves the real pages. The local database is seeded by global-setup; this file adds a few rows to it.
test.describe.configure({ mode: 'serial' });

const WHISTLER = '/p/demo-whistler';
const DAY = 86400;

let page: Page;
const sql = (statement: string) => runSql(statement, { remote: false });
const count = (event: string) => Number(sql(`SELECT COALESCE(SUM(count), 0) AS n FROM event_counts WHERE event = '${event}';`)[0]?.['n']);

async function axe(label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe on ${label}`).toEqual([]);
  console.log(`axe ${label}: ${results.violations.length} violation(s), 0 serious or critical`);
}
async function shot(name: string) {
  if (process.env['HICO_SCREENSHOTS'] === '1') await page.screenshot({ path: `docs/screenshots/phase-2/${name}.png` });
}
async function noSideScroll() {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}
const storedKeys = () => page.evaluate(() => Object.keys(window.localStorage));
const pickDay = async (name: string) => page.getByRole('list', { name: 'Choose a day' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();

test.beforeAll(async ({ browser }) => {
  const now = "CAST(strftime('%s','now') AS INTEGER)";
  const whistler = "(SELECT id FROM properties WHERE slug = 'demo-whistler')";
  sql(`
    INSERT INTO entry_codes (id, property_id, label, token_hash, created_at) SELECT 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', id, 'desk', '', ${now} FROM properties WHERE slug = 'demo-whistler';
    INSERT INTO offers (id, property_id, partner_name, terms_en, terms_fr, valid_from, valid_to, requires_membership, how_we_know_en, how_we_know_fr, verified_on, verified_by, is_placeholder, created_at)
      SELECT 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', id, 'E2E Rafting', '10% off a trip', '10 % de rabais sur une sortie', NULL, NULL, 1, 'We phoned them', '', ${now} - ${DAY}, 'Staff', 0, ${now} FROM properties WHERE slug = 'demo-whistler';
    UPDATE activities SET verified_on = ${now} - ${DAY} WHERE property_id = ${whistler} AND title_en = 'Trivia Night';
    UPDATE places SET verified_on = ${now} - 100 * ${DAY} WHERE property_id = ${whistler} AND name = 'Brandywine Falls';
    UPDATE places SET verified_on = ${now} - ${DAY}, maps_address = '1 Main St, Whistler' WHERE property_id = ${whistler} AND name = 'Purebread';
  `);
  const context = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 360, height: 740 }, locale: 'en-CA', timezoneId: 'America/Vancouver' });
  page = await context.newPage();
});
test.afterAll(async () => {
  await page.context().close();
  // Leave the local database as the seed made it for the specs that run after this one.
  sql("DELETE FROM offers WHERE id = 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'; DELETE FROM entry_codes WHERE id = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'; DELETE FROM event_counts WHERE event LIKE 'qr:%';");
});

test('first visit: the hostel choice, then What\'s On; no cookie and nothing stored on the device', async () => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your hostel' })).toBeVisible();
  await axe('hostel choice');
  await shot('01-hostel-choice');
  await page.getByRole('link', { name: 'Whistler', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeFocused();
  await axe("What's On");
  await shot('02-whats-on');
  expect(await page.context().cookies()).toEqual([]);
  expect(await storedKeys()).toEqual([]); // the language is stored only when the guest chooses one
  await noSideScroll();
});

test('What\'s On: category filter, search with no match (empty state), and "I\'m In" kept on this device', async () => {
  await pickDay('Fri');
  await expect(page.getByRole('heading', { name: 'Trivia Night' })).toBeVisible();
  await expect(page.locator('.stamp').first()).toContainText('Checked by staff on');
  await page.getByRole('button', { name: 'Adventure', exact: true }).click();
  await expect(page.getByText('Nothing matches your search.')).toBeVisible(); // Friday has only a social activity
  await axe('empty search state');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel("Search what's on").fill('TRIVIA');
  await expect(page.getByRole('heading', { name: 'Trivia Night' })).toBeVisible();
  await page.getByLabel("Search what's on").fill('');
  const imIn = page.getByRole('button', { name: /^I'm In/ });
  await imIn.first().click();
  await expect(imIn.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Saved to your plan on this device.' })).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem('hc_plan:demo-whistler'))) ?? '[]')).toHaveLength(1);
  await page.reload();
  await pickDay('Fri');
  await expect(page.getByRole('button', { name: /^I'm In/ }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show only my plan' }).click();
  await expect(page.getByRole('heading', { name: 'Trivia Night' })).toBeVisible();
  await axe('only my plan');
  await shot('03-my-plan');
  await page.getByRole('button', { name: 'Show only my plan' }).click();
  await noSideScroll();
});

test('keyboard only: pick a day, reach "I\'m In" and press it, open Settings and close it with Escape', async () => {
  await page.goto(`${WHISTLER}/whats-on`);
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const reach = async (match: (name: string) => boolean) => {
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText.trim() ?? '');
      if (match(name)) return;
    }
    throw new Error('did not reach the control by keyboard');
  };
  await reach((n) => n.startsWith('Sat'));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Train Wreck Hike' })).toBeVisible();
  await reach((n) => n.startsWith("I'm In"));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^I'm In/ }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Settings' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
});

test('Explore: places with a stamp, a stale place, a plain Maps link, an offer, and no rating', async () => {
  await page.goto(`${WHISTLER}/explore`);
  await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Rafting' })).toBeVisible();
  await expect(page.getByText('How we know: We phoned them')).toBeVisible();
  await expect(page.getByText('Membership needed')).toBeVisible();
  const maps = page.getByRole('link', { name: /Open in Maps/ });
  await expect(maps).toHaveCount(1);
  await expect(maps).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=1%20Main%20St%2C%20Whistler');
  await expect(maps).toHaveAttribute('target', '_blank');
  const brandywine = page.locator('li.card', { hasText: 'Brandywine Falls' });
  await expect(brandywine.locator('.stamp')).toContainText('Check at the desk'); // 100 days is past the 90-day demo limit
  await expect(page.locator('li.card', { hasText: 'Purebread' }).locator('.stamp')).toContainText('Checked by staff on');
  expect(await page.locator('main').innerText()).not.toMatch(/[★☆]|\bstars?\b|\brating\b/i);
  await axe('Explore');
  await shot('04-explore');
  await page.getByLabel('Search places and offers').fill('purebread');
  await expect(page.getByRole('heading', { name: /Purebread/ })).toBeVisible();
  await expect(page.getByText('Brandywine Falls')).toHaveCount(0);
  await noSideScroll();
});

test('a labelled QR link: counted once for its property, label removed from the address bar, nothing stored, no cookie', async () => {
  const before = count('qr:desk');
  const counted = page.waitForRequest((r) => r.url().endsWith('/api/p/demo-whistler/qr') && r.method() === 'POST');
  await page.goto(`${WHISTLER}#l=desk`);
  const body = (await counted).postDataJSON() as unknown;
  expect(body).toEqual({ label: 'desk' }); // the label and nothing else
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeVisible();
  expect(page.url()).not.toContain('#');
  expect(page.url()).not.toContain('desk');
  await expect.poll(() => count('qr:desk')).toBe(before + 1);
  expect(await page.context().cookies()).toEqual([]);
  const stored = await page.evaluate(async () => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage), dbs: (await indexedDB.databases()).length }));
  expect(stored.session).toEqual([]);
  expect(stored.dbs).toBe(0);
  expect(stored.local.filter((k) => /desk|qr|label|scan/i.test(k))).toEqual([]);
  // A label nobody created is not counted.
  await page.goto(`${WHISTLER}#l=made-up`);
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeVisible();
  expect(count('qr:made-up')).toBe(0);
});

test('Settings and privacy: every feature listed, every switch off and disabled, a visible placeholder for the privacy contact', async () => {
  await page.goto(`${WHISTLER}/whats-on`);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
  const switches = dialog.getByRole('switch');
  await expect(switches).toHaveCount(7);
  for (const s of await switches.all()) {
    await expect(s).toBeDisabled();
    await expect(s).not.toBeChecked();
  }
  await expect(dialog.getByText('Not available at this property yet').first()).toBeVisible();
  await expect(dialog.getByText('This property has not given a privacy contact yet.')).toBeVisible();
  await dialog.getByText('What this would do').first().click();
  await expect(dialog.getByText('How to stop').first()).toBeVisible();
  await axe('Settings and privacy');
  await shot('05-settings');
  await page.keyboard.press('Escape');
});

test('language switch: French follows through the screens, axe-clean', async () => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Français' }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Langue : Français' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: 'Au programme' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('fr');
  await axe('Au programme (French)');
  // No tab label is cut in half (it was: "program-me", "Rencontre-s", at 360 px).
  const cutWords = await page.evaluate(() => {
    const cut: string[] = [];
    for (const a of document.querySelectorAll('.tabs a')) {
      const node = a.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
        const tops = new Set<number>();
        for (let i = word.index; i < word.index + word[0].length; i += 1) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getClientRects()[0];
          if (rect) tops.add(Math.round(rect.top));
        }
        if (tops.size > 1) cut.push(word[0]);
      }
    }
    return cut;
  });
  expect(cutWords).toEqual([]);
  await shot('06-whats-on-french');
  await page.goto(`${WHISTLER}/explore`);
  await expect(page.getByRole('heading', { level: 1, name: 'Explorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Offres' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('anglais seulement'); // no string fell back to English
  await axe('Explorer (French)');
  await page.goto(`${WHISTLER}/whats-on`);
  await noSideScroll();
});

test('200% text and reduced motion: no sideways scroll on any screen, no running animation', async () => {
  const reduced = await page.context().browser()?.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 360, height: 740 }, reducedMotion: 'reduce', locale: 'en-CA' });
  const p = await reduced?.newPage();
  if (!p || !reduced) throw new Error('no context');
  for (const path of [`${WHISTLER}/whats-on`, `${WHISTLER}/explore`, '/']) {
    await p.goto(path);
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const { scroll, width } = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(scroll, path).toBeLessThanOrEqual(width);
    expect(await p.evaluate(() => document.getAnimations().length), path).toBe(0);
  }
  await reduced.close();
});

test('an unknown page and an unknown hostel say so plainly', async () => {
  await page.goto('/p/no-such-hostel/whats-on');
  await expect(page.getByRole('heading', { level: 1, name: /not find|trouv/i })).toBeVisible();
  await axe('not found');
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('Common Room and Connect say "Not turned on for this property" and ask nothing', async () => {
  await page.goto(`${WHISTLER}/whats-on`); // still in French from the language test
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('radio', { name: 'English' }).check();
  await page.keyboard.press('Escape');
  await page.goto(`${WHISTLER}/common-room`);
  await expect(page.getByRole('heading', { level: 1, name: 'Common Room' })).toBeVisible();
  await expect(page.getByText('Not turned on for this property')).toBeVisible();
  await page.goto(`${WHISTLER}/connect`);
  await expect(page.getByText('Not turned on for this property')).toBeVisible();
  await axe('Connect, not turned on');
});

test('offline: after one visit with a network, a reload with none shows the last copy and says so', async () => {
  await page.goto(`${WHISTLER}/explore`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });
  await page.reload(); // the first load was not yet under the service worker; this one is, so its content is kept
  await expect(page.getByRole('heading', { name: 'E2E Rafting' })).toBeVisible();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Rafting' })).toBeVisible();
  await expect(page.getByText('You are offline. Showing what was loaded last.')).toBeVisible();
  await axe('Explore, offline');
  await shot('07-offline');
  await page.context().setOffline(false);
  await expect(page.getByText('You are offline.')).toHaveCount(0);
});

test('the service worker keeps nothing from the staff area', async () => {
  await page.goto('/staff');
  await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible();
  await page.evaluate(() => fetch('/api/staff/auth/me'));
  const kept = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(kept.length).toBeGreaterThan(0);
  expect(kept.filter((u) => u.includes('staff'))).toEqual([]);
  expect(kept.filter((u) => u.startsWith('/api/') && !/^\/api\/(hosts\/properties|p\/[a-z0-9-]+\/(config|activities|places|offers))$/.test(u))).toEqual([]);
});

test('Delete my data: asks first, then clears storage, caches and the service worker, and starts again from nothing', async () => {
  await page.goto(`${WHISTLER}/whats-on`);
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeVisible();
  expect((await storedKeys()).length).toBeGreaterThan(0); // the plan and the language are on the device
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Delete my data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete my data' });
  await expect(confirm).toContainText('cannot be undone');
  await axe('Delete my data confirmation');
  await shot('08-delete-confirm');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  expect((await storedKeys()).length).toBeGreaterThan(0); // cancelling deleted nothing
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await page.getByRole('dialog', { name: 'Delete my data' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Everything this site saved on this device has been deleted.' })).toBeVisible();
  expect(await storedKeys()).toEqual([]);
  // Nothing is left behind at the moment of deletion (the page has not reloaded, so nothing has refilled the caches).
  const left = await page.evaluate(async () => ({ caches: (await caches.keys()).length, workers: (await navigator.serviceWorker.getRegistrations()).length, session: Object.keys(window.sessionStorage).length }));
  expect(left).toEqual({ caches: 0, workers: 0, session: 0 });
  await shot('09-delete-done');
  // Closing reloads the page, so the service worker that was serving it cannot refill the caches it just lost.
  await Promise.all([page.waitForEvent('load'), page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()]);
  await expect(page.getByRole('heading', { level: 1, name: "What's On" })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await storedKeys()).toEqual([]);
  await expect(page.getByRole('button', { name: /^I'm In/ }).first()).toHaveAttribute('aria-pressed', 'false'); // the plan is gone
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en'); // back to the browser's language, and not stored again
  expect(await storedKeys()).toEqual([]);
});

test('no emoji without a text alternative, and no third-party request is made by any screen', async () => {
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  for (const path of [`${WHISTLER}/whats-on`, `${WHISTLER}/explore`, `${WHISTLER}/common-room`, '/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => /\p{Extended_Pictographic}/u.test(document.body.innerText)), path).toBe(false);
  }
  expect([...hosts]).toEqual(['localhost:4173']);
});
