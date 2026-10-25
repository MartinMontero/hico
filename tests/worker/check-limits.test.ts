import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { CHECK_LIMIT_DAYS, DAY_SECONDS } from '../../shared/check-limits.ts';
import type { StaffActivity, StaffOffer, StaffPlace } from '../../shared/types.ts';
import { call } from '../support/app.ts';
import { makeProperty, makeStaff, nameStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

// An item checked just inside its limit is current; just outside, it is not. The limits come from shared\check-limits.ts,
// so changing that file cannot leave the guest side and the staff side disagreeing (D-33).

let P: PropertyFixture;
let cookie: string;
const SLUG = 'cl-a';
const json = async <T>(res: Response) => (await res.json()) as T;
const staff = (path: string, body?: unknown) => call(`/api/staff/p/${SLUG}${path}`, { host: P.host, method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie }, body });
const guest = (path: string) => call(`/api/p/${SLUG}${path}`, { host: P.host });
const ago = (days: number) => Math.floor(Date.now() / 1000) - days * DAY_SECONDS;

beforeAll(async () => {
  P = await makeProperty(env.DB, SLUG, { host: 'cl-a.test' });
  const person = await makeStaff(env.DB, 'cl@x.test', [{ propertyId: P.id, role: 'admin' }]);
  await nameStaff(env.DB, person, 'Checker');
  cookie = await sessionCookieFor(env.DB, person);
});

const stamp = (table: 'activities' | 'places' | 'offers', id: string, days: number) =>
  env.DB.prepare(`UPDATE ${table} SET verified_on = ?2 WHERE id = ?1`).bind(id, ago(days)).run();

describe('the check limits', () => {
  it('are the three demo values, in days, from the one shared file', () => {
    expect(CHECK_LIMIT_DAYS).toEqual({ board: 90, places: 90, offers: 90 });
  });

  it('board: 89 days is current, 91 is overdue, for staff; guests receive the stamp to apply the same rule', async () => {
    const make = async (title: string) =>
      json<StaffActivity>(await staff('/activities', { titleEn: title, titleFr: '', descriptionEn: '', descriptionFr: '', changeNoteEn: '', changeNoteFr: '', category: 'social', zoneId: null, hostLabel: '', capacity: null, schedule: { kind: 'weekly', weekday: 2, startLocal: '19:00', endLocal: null } }));
    const fresh = await make('Fresh board item');
    const old = await make('Old board item');
    await stamp('activities', fresh.id, CHECK_LIMIT_DAYS.board - 1);
    await stamp('activities', old.id, CHECK_LIMIT_DAYS.board + 1);
    const list = await json<StaffActivity[]>(await staff('/activities'));
    expect(list.find((a) => a.id === fresh.id)?.check).toBe('ok');
    expect(list.find((a) => a.id === old.id)?.check).toBe('overdue');
    const seen = await json<{ id: string; verifiedOn: number | null }[]>(await guest('/activities'));
    expect(seen.find((a) => a.id === old.id)?.verifiedOn).toBe(list.find((a) => a.id === old.id)?.verifiedOn); // guests get the date; the page decides with the same limit
  });

  it('places: 89 days is current, 91 is overdue', async () => {
    const make = async (name: string) =>
      json<StaffPlace>(await staff('/places', { category: 'food', name, staffPick: false, noteEn: '', noteFr: '', walkTimeEn: '', walkTimeFr: '', hoursEn: '', hoursFr: '', phone: null, mapsAddress: '' }));
    const fresh = await make('Fresh place');
    const old = await make('Old place');
    await stamp('places', fresh.id, CHECK_LIMIT_DAYS.places - 1);
    await stamp('places', old.id, CHECK_LIMIT_DAYS.places + 1);
    const list = await json<StaffPlace[]>(await staff('/places'));
    expect(list.find((p) => p.id === fresh.id)?.check).toBe('ok');
    expect(list.find((p) => p.id === old.id)?.check).toBe('overdue');
  });

  it('offers: 89 days is shown, 91 is hidden from guests and flagged for staff', async () => {
    const make = async (partnerName: string) =>
      json<StaffOffer>(await staff('/offers', { partnerName, termsEn: '10% off', termsFr: '', validFrom: null, validTo: null, requiresMembership: false, howWeKnowEn: '', howWeKnowFr: '' }));
    const fresh = await make('Fresh offer');
    const old = await make('Old offer');
    await stamp('offers', fresh.id, CHECK_LIMIT_DAYS.offers - 1);
    await stamp('offers', old.id, CHECK_LIMIT_DAYS.offers + 1);
    const list = await json<StaffOffer[]>(await staff('/offers'));
    expect(list.find((o) => o.id === fresh.id)?.guestState).toBe('shown');
    expect(list.find((o) => o.id === old.id)?.guestState).toBe('unchecked');
    const shown = await json<{ id: string }[]>(await guest('/offers'));
    expect(shown.some((o) => o.id === fresh.id)).toBe(true);
    expect(shown.some((o) => o.id === old.id)).toBe(false);
  });
});
