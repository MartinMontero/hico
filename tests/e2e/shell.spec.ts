import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Rendered shell at 360 px width: axe-core must find no serious or critical violation, the page
// must not scroll sideways, and everything must work by keyboard alone.

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `axe violations on ${label}`,
  ).toEqual([]);
  console.log(`axe ${label}: ${results.violations.length} violation(s) of any impact, 0 serious or critical; ${results.passes.length} rules passed`);
}

async function noSideScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, 'horizontal scroll').toBeLessThanOrEqual(width);
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    // The not-found test provokes 404s on purpose; the browser logs them as console errors.
    if (m.type() === 'error' && !(test.info().title.includes('not-found') && /status of 404/.test(m.text()))) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost') problems.push(`external request to ${r.url()}`);
  });
  (page as Page & { problems?: string[] }).problems = problems;
});
test.afterEach(async ({ page }) => {
  const problems = (page as Page & { problems?: string[] }).problems ?? [];
  expect(problems, 'console errors (including CSP violations) and external requests').toEqual([]);
});

test('hostel choice lists the three seeded properties and shows no HI mark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your hostel' })).toBeVisible();
  await expect(page.getByRole('link')).toHaveText(['Skip to content', 'Whistler', 'Vancouver Downtown', 'Vancouver Jericho Beach']);
  expect(await page.locator('body').innerText()).not.toMatch(/\bHI\b/);
  await expect(page.locator('img, svg')).toHaveCount(0); // text-only header, no logo
  await axe(page, 'hostel choice');
  await noSideScroll(page);
});

test('Whistler shell: header, four tabs, sample band, axe-clean on every tab', async ({ page }) => {
  await page.goto('/p/demo-whistler/whats-on');
  await expect(page.locator('.property-name')).toHaveText('Whistler');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(["What's On", 'Explore', 'Common Room', 'Connect']);
  await expect(page.getByRole('note')).toContainText('Sample content');
  await expect(page).toHaveTitle("What's On · Whistler");
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("What's On");
  await expect(page.getByRole('list', { name: 'Choose a day' }).getByRole('button')).toHaveCount(7);
  await axe(page, "What's On");
  await noSideScroll(page);

  await page.getByRole('link', { name: 'Explore' }).click();
  await expect(page).toHaveURL(/\/p\/demo-whistler\/explore$/);
  await expect(page.getByText("Cheaky's Cafe")).toHaveCount(0); // that is an activity, not a place
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await axe(page, 'Explore');
  await noSideScroll(page);

  for (const [name, path] of [['Common Room', 'common-room'], ['Connect', 'connect']] as const) {
    await page.getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.getByText('Not turned on for this property')).toBeVisible();
    await axe(page, name);
  }
});

test('the week of activities is shown and no rating or guest name appears', async ({ page }) => {
  await page.goto('/p/demo-whistler/whats-on');
  const days = page.getByRole('list', { name: 'Choose a day' }).getByRole('button');
  const seen = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    await days.nth(i).click();
    for (const t of await page.locator('.card-title').allInnerTexts()) seen.add(t);
  }
  expect(seen.size).toBeGreaterThanOrEqual(8); // 10 weekly activities across seven weekdays
  await page.goto('/p/demo-whistler/explore');
  await expect(page.locator('main ul.cards').first().locator('li.card')).toHaveCount(24); // the places; offers are a second list
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/★|rating|Lisa K|Marco P|dorm/i);
  expect(text).toContain('Staff pick');
});

test('a shared activity is the same record at both Vancouver hostels (D-15)', async ({ page, request }) => {
  await page.goto('/');
  const down = (await (await request.get('/api/p/vancouver-downtown/activities')).json()) as { id: string; title: { en: string } }[];
  const jer = (await (await request.get('/api/p/vancouver-jericho-beach/activities')).json()) as { id: string }[];
  expect(down.length).toBe(3);
  expect(jer.map((a) => a.id).sort()).toEqual(down.map((a) => a.id).sort());
  const whistler = (await (await request.get('/api/p/demo-whistler/activities')).json()) as { id: string }[];
  expect(whistler.some((a) => down.some((d) => d.id === a.id))).toBe(false);
  // The host's list is the only way in: an unlisted slug is a flat 404.
  expect((await request.get('/api/p/not-a-hostel/config')).status()).toBe(404);
});

test('keyboard only: skip link, tabs, heading focus, settings dialog trap and Escape', async ({ page }) => {
  await page.goto('/p/demo-whistler/whats-on');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // Tab order: skip link, Settings, then the four tabs.
  const order: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim()));
  }
  expect(order).toEqual(['Skip to content', 'Settings', "What's On", 'Explore', 'Common Room', 'Connect']);

  // Activate a tab with Enter: the route changes and focus moves to the page heading.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim())).toBe('Explore');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeFocused();

  // Open Settings with the keyboard.
  await page.getByRole('button', { name: 'Settings' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'English' })).toBeFocused();
  await axe(page, 'Settings dialog');

  // Tab stays inside the dialog.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  // The page behind is inert: nothing outside can be reached.
  expect(await page.evaluate(() => document.querySelector('.app-content')?.hasAttribute('inert'))).toBe(true);

  // Escape closes and focus returns to the Settings button.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
});

test('French: the language choice changes the page, the document language and announces a toast', async ({ page }) => {
  await page.goto('/p/demo-whistler/whats-on');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Français' }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Langue' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Au programme');
  await expect(page.getByRole('navigation', { name: 'Principale' }).getByRole('link')).toHaveText(['Au programme', 'Explorer', 'Salle commune', 'Rencontres']);
  await axe(page, 'French shell');
  await noSideScroll(page);
  // The choice stays on the device.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('an unknown hostel or page shows (not-found) a plain not-found page with a way back', async ({ page }) => {
  await page.goto('/p/no-such-place/whats-on');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that page.');
  await expect(page.getByRole('link', { name: 'Choose a hostel' })).toBeVisible();
  await axe(page, 'not found');
});

test('200% text zoom does not scroll sideways', async ({ page }) => {
  await page.goto('/p/demo-whistler/explore');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); // CSSOM change: allowed by the CSP
  await noSideScroll(page);
});
