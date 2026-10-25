import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicActivity, PublicOffer, PublicPlace, PublicProperty } from '../../shared/types.ts';
import { DAY_SECONDS } from '../../shared/check-limits.ts';
import { noteServerDate, nowMs, resetClock } from '../../web/src/clock.ts';
import { UiProvider } from '../../web/src/context.tsx';
import { mapsUrl } from '../../web/src/links.ts';
import { Explore, WhatsOn } from '../../web/src/pages.tsx';
import { readPlan, writePlan } from '../../web/src/plan.ts';
import { matches, normalize } from '../../web/src/search.ts';
import { weekdayOf, ymdInZone } from '../../web/src/time.ts';

// The guest screens with a stubbed network: filter, search (in the guest's language), "I'm In" (device only), the
// stamp, the Maps link, offers, and what is never shown (a rating).

const TZ = 'America/Vancouver';
const property: PublicProperty = { slug: 'demo', name: { en: 'Demo', fr: 'Démo' }, timezone: TZ, languages: ['en', 'fr'], features: { common_room: false, connect: false }, hasPlaceholders: false };
const nowSec = () => Math.floor(nowMs() / 1000);
const todayWeekday = () => weekdayOf(ymdInZone(new Date(nowMs()), TZ));

const activity = (over: Partial<PublicActivity>): PublicActivity => ({
  id: 'a'.repeat(32), title: { en: 'Trivia Night', fr: 'Soirée-questionnaire' }, description: { en: 'Bring a friend', fr: 'Amenez un ami' }, category: 'social', zone: null, hostLabel: 'Staff',
  timezone: TZ, weekday: todayWeekday(), startLocal: '19:00', endLocal: null, startsAt: null, endsAt: null, capacity: null, status: 'active', cancelledDates: [],
  verifiedOn: nowSec() - DAY_SECONDS, isPlaceholder: false, ...over,
});
const place = (over: Partial<PublicPlace>): PublicPlace => ({
  id: 'p'.repeat(32), category: 'food', name: 'Café Corner', staffPick: true, note: { en: 'Good coffee', fr: 'Bon café' }, walkTime: { en: '5 min', fr: '5 min' }, hours: { en: '', fr: '' }, phone: null,
  mapsAddress: '1 Main St, Whistler', verifiedOn: nowSec() - DAY_SECONDS, isPlaceholder: false, ...over,
});
const offer = (over: Partial<PublicOffer>): PublicOffer => ({
  id: 'o'.repeat(32), partnerName: 'Rafting Co', terms: { en: '10% off', fr: '10 % de rabais' }, validFrom: nowSec() - 5 * DAY_SECONDS, validTo: nowSec() + 5 * DAY_SECONDS, requiresMembership: true,
  howWeKnow: { en: 'We phoned them', fr: '' }, verifiedOn: nowSec() - DAY_SECONDS, isPlaceholder: false, ...over,
});

let container: HTMLElement;
let posts: string[];
function stubNetwork(data: { activities?: PublicActivity[]; places?: PublicPlace[]; offers?: PublicOffer[] }) {
  posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body));
        return new Response(null, { status: 204 });
      }
      const body = url.endsWith('/activities') ? (data.activities ?? []) : url.endsWith('/places') ? (data.places ?? []) : url.endsWith('/offers') ? (data.offers ?? []) : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); });
const show = async (node: preact.ComponentChild) => {
  await act(() => render(<UiProvider>{node}</UiProvider>, container));
  await settle();
};
const type = async (label: string, text: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[type="search"]`);
  expect(input?.labels?.[0]?.textContent, label).toBe(label);
  await act(() => {
    (input as HTMLInputElement).value = text;
    (input as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const click = (el: Element | null | undefined) => act(() => { (el as HTMLElement).click(); });
const button = (name: string | RegExp) => [...container.querySelectorAll('button')].find((b) => (typeof name === 'string' ? b.textContent === name : name.test(b.textContent ?? '')));
const titles = () => [...container.querySelectorAll('.card-title')].map((e) => e.textContent);

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  window.localStorage.clear();
  resetClock();
});
afterEach(() => {
  render(null, container);
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("What's On", () => {
  const list = () => [
    activity({ id: 'a'.repeat(32) }),
    activity({ id: 'b'.repeat(32), title: { en: 'Dog Mountain Hike', fr: 'Randonnée à Dog Mountain' }, description: { en: 'Group hike', fr: 'Randonnée en groupe' }, category: 'adventure', startLocal: '10:00' }),
  ];

  it('lists today\'s activities and filters by category', async () => {
    stubNetwork({ activities: list() });
    await show(<WhatsOn property={property} />);
    expect(titles()).toEqual(['Dog Mountain Hike', 'Trivia Night']); // earliest first
    await click(button('Adventure'));
    expect(titles()).toEqual(['Dog Mountain Hike']);
    await click(button('All'));
    expect(titles()).toHaveLength(2);
  });

  it('searches the text the guest reads, ignoring case and accents, in French when the guest reads French', async () => {
    window.localStorage.setItem('hc_lang', 'fr');
    stubNetwork({ activities: list() });
    await show(<WhatsOn property={property} />);
    expect(titles()).toEqual(['Randonnée à Dog Mountain', 'Soirée-questionnaire']);
    await type('Rechercher au programme', 'RANDONNEE');
    expect(titles()).toEqual(['Randonnée à Dog Mountain']);
    await type('Rechercher au programme', 'trivia'); // English words are not searched when the guest reads French
    expect(container.textContent).toContain('Aucun résultat');
  });

  it('"I\'m In" keeps the activity in a plan on this device only, with no count, and "only my plan" shows just it', async () => {
    stubNetwork({ activities: list() });
    await show(<WhatsOn property={property} />);
    const imIn = [...container.querySelectorAll('button')].filter((b) => b.textContent?.startsWith("I'm In"));
    expect(imIn).toHaveLength(2);
    await click(imIn[0]);
    expect(imIn[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.toast-region')).toBeNull(); // the toast region lives in the app shell, not here
    expect(JSON.parse(window.localStorage.getItem('hc_plan:demo') ?? '[]')).toHaveLength(1);
    expect(posts).not.toContainEqual(expect.stringMatching(/plan|imin/i)); // nothing about the plan is sent anywhere
    expect(container.textContent).not.toMatch(/\b\d+ (going|people|guests)\b/i);
    await click(button('Show only my plan'));
    expect(titles()).toHaveLength(1);
    await click(imIn[0]);
    expect(titles()).toHaveLength(0);
    expect(container.textContent).toContain('Nothing from your plan');
  });

  it('still works when storage is blocked: the plan lives in memory for the visit', async () => {
    stubNetwork({ activities: list() });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await show(<WhatsOn property={property} />);
    const first = [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith("I'm In"));
    await click(first);
    expect(first?.getAttribute('aria-pressed')).toBe('true');
  });

  it('a stamp past the limit says to check at the desk; a recent one does not', async () => {
    stubNetwork({ activities: [activity({ verifiedOn: nowSec() - 91 * DAY_SECONDS }), activity({ id: 'c'.repeat(32), title: { en: 'Fresh', fr: 'Frais' }, verifiedOn: nowSec() - 89 * DAY_SECONDS })] });
    await show(<WhatsOn property={property} />);
    const stamps = [...container.querySelectorAll('.stamp')].map((s) => s.textContent ?? '');
    expect(stamps.filter((s) => s.includes('Check at the desk'))).toHaveLength(1);
    expect(stamps.filter((s) => s.startsWith('Checked by staff on'))).toHaveLength(1);
  });

  it('a cancelled date is shown as cancelled', async () => {
    stubNetwork({ activities: [activity({ cancelledDates: [ymdInZone(new Date(nowMs()), TZ)] })] });
    await show(<WhatsOn property={property} />);
    expect(container.querySelector('.card.cancelled')).not.toBeNull();
    expect(container.textContent).toContain('Cancelled');
  });
});

describe('Explore', () => {
  it('shows staff picks as a label, never a rating, and a Maps link that points nowhere until tapped', async () => {
    stubNetwork({ places: [place({}), place({ id: 'q'.repeat(32), name: 'No Address', mapsAddress: '' })] });
    await show(<Explore property={property} />);
    expect(container.textContent).toContain('Staff pick');
    expect(container.textContent).not.toMatch(/[★☆]|\d(\.\d)?\s*\/\s*5|\bstars?\b|rating/i);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links).toHaveLength(1); // the place without an address has no link
    expect(links[0]?.href).toBe(mapsUrl('1 Main St, Whistler'));
    expect(links[0]?.target).toBe('_blank');
    expect(links[0]?.rel).toContain('noopener');
    expect(links[0]?.rel).toContain('noreferrer');
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('google'), expect.anything());
  });

  it('shows offers with terms, dates and a membership label, and counts that an offer was shown (no person)', async () => {
    stubNetwork({ places: [place({})], offers: [offer({})] });
    await show(<Explore property={property} />);
    expect(container.textContent).toContain('Rafting Co');
    expect(container.textContent).toContain('10% off');
    expect(container.textContent).toMatch(/Valid .* to /);
    expect(container.textContent).toContain('Membership needed');
    expect(container.textContent).toContain('How we know: We phoned them');
    expect(posts).toContain(JSON.stringify({ event: 'offer_shown' }));
  });

  it('says so when there are no offers, and sends no offer_shown count', async () => {
    stubNetwork({ places: [place({})], offers: [] });
    await show(<Explore property={property} />);
    expect(container.textContent).toContain('No offers right now.');
    expect(posts).not.toContain(JSON.stringify({ event: 'offer_shown' }));
  });

  it('search finds "Café" from "cafe" and filters offers too', async () => {
    stubNetwork({ places: [place({}), place({ id: 'r'.repeat(32), name: 'Trail Head', category: 'trails', note: { en: 'A trail', fr: 'Un sentier' } })], offers: [offer({})] });
    await show(<Explore property={property} />);
    await type('Search places and offers', 'cafe');
    expect(titles()).toEqual(['Café CornerStaff pick']); // the offer does not match; the badge text is part of the heading
    await type('Search places and offers', 'rafting');
    expect(titles()).toEqual(['Rafting Co']);
    await click(button('Trails'));
    expect(container.textContent).toContain('Nothing matches your search.');
  });
});

describe('the small pieces', () => {
  it('search ignores case and accents and needs every word', () => {
    expect(normalize('  Café  ')).toBe('cafe');
    expect(matches('cafe corner', ['Café Corner'])).toBe(true);
    expect(matches('cafe pizza', ['Café Corner'])).toBe(false);
    expect(matches('', ['anything'])).toBe(true);
  });

  it('the plan survives a reload, ignores junk, and tolerates blocked storage', () => {
    writePlan('x', new Set(['a', 'b']));
    expect([...readPlan('x')].sort()).toEqual(['a', 'b']);
    window.localStorage.setItem('hc_plan:y', '{"not":"an array"}');
    expect(readPlan('y').size).toBe(0);
    window.localStorage.setItem('hc_plan:z', '[1,"ok",null]');
    expect([...readPlan('z')]).toEqual(['ok']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPlan('x').size).toBe(0);
  });

  it('the Maps link puts the address in the query and nothing else about the guest', () => {
    expect(mapsUrl('1 Main St & Co')).toBe('https://www.google.com/maps/search/?api=1&query=1%20Main%20St%20%26%20Co');
  });

  it('"now" follows the server\'s Date header, and ignores one that came from the cache', () => {
    const before = Date.now();
    noteServerDate(new Date(before + 3 * 3600_000).toUTCString(), false);
    expect(nowMs() - before).toBeGreaterThan(3 * 3600_000 - 5000);
    resetClock();
    noteServerDate(new Date(before + 3 * 3600_000).toUTCString(), true);
    expect(Math.abs(nowMs() - before)).toBeLessThan(5000);
    noteServerDate('not a date', false);
    expect(Math.abs(nowMs() - before)).toBeLessThan(5000);
  });
});
