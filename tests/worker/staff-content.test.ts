import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { STAFF_FIELDS, type StaffActivity, type StaffOffer, type StaffPlace, type StaffZone } from '../../shared/types.ts';
import { createApp } from '../../worker/app.ts';
import { call } from '../support/app.ts';
import { makeProperty, makeStaff, nameStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

// The content routes of the staff console over HTTP: stamping, versions, the D-23 rules, audit, export, XSS.
// The role matrix (every route, every persona) is in tests/worker/staff-matrix.test.ts.

let A: PropertyFixture, B: PropertyFixture;
let adminA: string, editorA: string, adminB: string, adminAB: string, editorB: string;
let cAdminA: string, cEditorA: string, cAdminB: string, cAdminAB: string, cEditorB: string;
let zoneA: string;

const base = (slug: string) => `/api/staff/p/${slug}`;
const send = (cookie: string, slug: string, method: 'GET' | 'POST', path: string, body?: unknown) =>
  call(`${base(slug)}${path}`, { host: slug === 'sc-a' ? A.host : B.host, method, headers: { Cookie: cookie }, body: method === 'POST' ? (body ?? {}) : undefined });
const postA = (cookie: string, path: string, body?: unknown) => send(cookie, 'sc-a', 'POST', path, body);
const getA = (cookie: string, path: string) => send(cookie, 'sc-a', 'GET', path);
const json = async <T>(res: Response) => (await res.json()) as T;
const names = (value: unknown, into = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) for (const v of value) names(v, into);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      names(v, into);
    }
  }
  return into;
};

/** Runs a mutation and asserts it left exactly one audit row with this action under THIS property, and none under the other. */
async function audited<T>(route: string, action: string, property: PropertyFixture, other: PropertyFixture, run: () => Promise<T>): Promise<T> {
  const count = async (p: PropertyFixture) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE property_id = ?1 AND action = ?2').bind(p.id, action).first<{ n: number }>())?.n ?? 0;
  const [before, beforeOther] = [await count(property), await count(other)];
  const result = await run();
  expect(await count(property), `${route} wrote no ${action} row`).toBe(before + 1);
  expect(await count(other), `${route} wrote ${action} under the other property`).toBe(beforeOther);
  return result;
}

const weekly = { kind: 'weekly' as const, weekday: 2, startLocal: '19:00', endLocal: '21:00' };
const activityBody = (over: Record<string, unknown> = {}) => ({
  titleEn: 'Trivia', titleFr: 'Quiz', descriptionEn: 'Bring a friend', descriptionFr: 'Amenez un ami', changeNoteEn: '', changeNoteFr: '', category: 'social', zoneId: null, hostLabel: 'Staff', capacity: null, schedule: weekly, ...over,
});
const placeBody = (over: Record<string, unknown> = {}) => ({
  category: 'food', name: 'Corner Cafe', staffPick: true, noteEn: 'Good coffee', noteFr: 'Bon café', walkTimeEn: '5 min', walkTimeFr: '5 min', hoursEn: '8 to 4', hoursFr: '8 à 16', phone: null, mapsAddress: '1 Main St', ...over,
});
const offerBody = (over: Record<string, unknown> = {}) => ({
  partnerName: 'Rafting Co', termsEn: '10% off', termsFr: '10 % de rabais', validFrom: null, validTo: null, requiresMembership: false, howWeKnowEn: 'Phoned them', howWeKnowFr: '', ...over,
});

beforeAll(async () => {
  A = await makeProperty(env.DB, 'sc-a', { host: 'sc.test' });
  B = await makeProperty(env.DB, 'sc-b', { host: 'sc-b.test' });
  adminA = await makeStaff(env.DB, 'admin-a@sc.test', [{ propertyId: A.id, role: 'admin' }]);
  editorA = await makeStaff(env.DB, 'editor-a@sc.test', [{ propertyId: A.id, role: 'editor' }]);
  adminB = await makeStaff(env.DB, 'admin-b@sc.test', [{ propertyId: B.id, role: 'admin' }]);
  adminAB = await makeStaff(env.DB, 'admin-ab@sc.test', [{ propertyId: A.id, role: 'admin' }, { propertyId: B.id, role: 'admin' }]);
  editorB = await makeStaff(env.DB, 'editor-b@sc.test', [{ propertyId: B.id, role: 'editor' }]);
  for (const [id, n] of [[adminA, 'Alex Admin'], [editorA, 'Eli Editor'], [adminB, 'Bea Admin'], [adminAB, 'Cam Both'], [editorB, 'Bo Editor']] as const) await nameStaff(env.DB, id, n);
  cAdminA = await sessionCookieFor(env.DB, adminA);
  cEditorA = await sessionCookieFor(env.DB, editorA);
  cAdminB = await sessionCookieFor(env.DB, adminB);
  cAdminAB = await sessionCookieFor(env.DB, adminAB);
  cEditorB = await sessionCookieFor(env.DB, editorB);
  const z = await postA(cAdminA, '/zones', { labelEn: 'Lobby', labelFr: 'Hall', ring: 'in_hostel' });
  zoneA = (await json<StaffZone>(z)).id;
});

describe('verification stamps are the server\'s alone', () => {
  it('a client cannot supply verified_on or verified_by on create, update or re-verify; the stamp is the signed-in person and now', async () => {
    const forged = { verified_on: 1, verifiedOn: 1, verified_by: 'Somebody Else', verifiedBy: 'Somebody Else', is_placeholder: 1, isPlaceholder: true, version: 1 };
    const before = Math.floor(Date.now() / 1000);
    const created = await audited('POST /api/staff/p/:slug/places', 'staff.place.created', A, B, async () => postA(cEditorA, '/places', { ...placeBody(), ...forged }));
    expect(created.status).toBe(200);
    const place = await json<StaffPlace>(created);
    expect(place.verifiedBy).toBe('Eli Editor');
    expect(place.verifiedOn).toBeGreaterThanOrEqual(before);
    expect(place.isPlaceholder).toBe(false);
    const updated = await audited('POST /api/staff/p/:slug/places/:id', 'staff.place.updated', A, B, async () => postA(cAdminA, `/places/${place.id}`, { ...placeBody({ name: 'Renamed' }), ...forged, version: place.version }));
    const afterUpdate = await json<StaffPlace>(updated);
    expect(afterUpdate).toMatchObject({ name: 'Renamed', verifiedBy: 'Alex Admin' });
    expect(afterUpdate.verifiedOn).toBeGreaterThanOrEqual(before);
    const reverified = await audited('POST /api/staff/p/:slug/places/:id/reverify', 'staff.place.reverified', A, B, async () => postA(cEditorA, `/places/${place.id}/reverify`, { ...forged, version: afterUpdate.version }));
    const after = await json<StaffPlace>(reverified);
    expect(after).toMatchObject({ name: 'Renamed', verifiedBy: 'Eli Editor', version: afterUpdate.version + 1 }); // the text is untouched
    // The same for the board and for offers.
    const act = await json<StaffActivity>(await audited('POST /api/staff/p/:slug/activities', 'staff.activity.created', A, B, async () => postA(cEditorA, '/activities', { ...activityBody(), ...forged })));
    expect(act).toMatchObject({ verifiedBy: 'Eli Editor', isPlaceholder: false });
    const reAct = await audited('POST /api/staff/p/:slug/activities/:id/reverify', 'staff.activity.reverified', A, B, async () => postA(cAdminA, `/activities/${act.id}/reverify`, { ...forged, version: act.version }));
    expect(reAct.status).toBe(200);
    expect(await json<StaffActivity>(reAct)).toMatchObject({ verifiedBy: 'Alex Admin', version: act.version + 1, title: act.title });
    const offer = await json<StaffOffer>(await audited('POST /api/staff/p/:slug/offers', 'staff.offer.created', A, B, async () => postA(cEditorA, '/offers', { ...offerBody(), ...forged })));
    expect(offer).toMatchObject({ verifiedBy: 'Eli Editor' });
  });

  it('guests see the date, never the name', async () => {
    const guest = await call('/api/p/sc-a/places', { host: A.host });
    const rows = await json<Record<string, unknown>[]>(guest);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r['verifiedOn']).not.toBeUndefined();
      expect('verifiedBy' in r).toBe(false);
    }
    expect(JSON.stringify(rows)).not.toMatch(/Eli Editor|Alex Admin/);
    expect(names(await json(await call('/api/p/sc-a/activities', { host: A.host }))).has('verifiedBy')).toBe(false);
  });
});

describe('the board', () => {
  it('creates weekly and one-off activities in the property\'s time zone, and shows exactly the staff fields', async () => {
    const one = await postA(cEditorA, '/activities', activityBody({ titleEn: 'Pumpkin night', schedule: { kind: 'one_off', date: '2026-10-25', startLocal: '18:00', endLocal: '20:00' } }));
    expect(one.status).toBe(200);
    const view = await json<StaffActivity>(one);
    expect(view.schedule).toEqual({ kind: 'one_off', date: '2026-10-25', startLocal: '18:00', endLocal: '20:00' });
    expect(view.timezone).toBe('America/Vancouver');
    // Stored as an instant: 18:00 Vancouver time on 25 October 2026 is 01:00 UTC on the 26th (UTC-7).
    const row = await env.DB.prepare('SELECT starts_at, ends_at, start_local FROM activities WHERE id = ?1').bind(view.id).first<{ starts_at: number; ends_at: number; start_local: string | null }>();
    expect(row).toEqual({ starts_at: Date.parse('2026-10-26T01:00:00Z') / 1000, ends_at: Date.parse('2026-10-26T03:00:00Z') / 1000, start_local: null });
    const list = await json<Record<string, unknown>[]>(await getA(cEditorA, '/activities'));
    for (const a of list) expect(Object.keys(a).sort()).toEqual([...STAFF_FIELDS.activity].sort());
    expect(JSON.stringify(list)).not.toContain(A.id);
    expect(JSON.stringify(list)).not.toContain(B.id);
  });

  it('refuses bad schedules, over-long text, unknown categories and a zone of another property', async () => {
    const bad = (over: Record<string, unknown>) => postA(cEditorA, '/activities', activityBody(over));
    expect((await bad({ schedule: { kind: 'weekly', weekday: 7, startLocal: '19:00', endLocal: null } })).status).toBe(400);
    expect((await bad({ schedule: { kind: 'weekly', weekday: 1, startLocal: '25:00', endLocal: null } })).status).toBe(400);
    expect((await bad({ schedule: { kind: 'weekly', weekday: 1, startLocal: '19:00', endLocal: '18:00' } })).status).toBe(400);
    expect((await bad({ schedule: { kind: 'one_off', date: '2026-13-40', startLocal: '19:00', endLocal: null } })).status).toBe(400);
    expect((await bad({ titleEn: '' })).status).toBe(400);
    expect((await bad({ titleEn: 'x'.repeat(121) })).status).toBe(400);
    expect((await bad({ descriptionEn: 'x'.repeat(601) })).status).toBe(400);
    expect((await bad({ category: 'nonsense' })).status).toBe(400);
    expect((await bad({ capacity: 0 })).status).toBe(400);
    expect((await bad({ titleEn: 'Null\u0000byte' })).status).toBe(400);
    const zoneB = await json<StaffZone>(await send(cAdminB, 'sc-b', 'POST', '/zones', { labelEn: 'B lobby', labelFr: '', ring: 'in_hostel' }));
    const wrongZone = await bad({ zoneId: zoneB.id });
    expect(wrongZone.status).toBe(400);
    expect(await wrongZone.json()).toEqual({ error: 'bad_zone' });
    expect((await bad({ zoneId: zoneA })).status).toBe(200);
    expect((await postA(cEditorA, '/activities', 'not json at all')).status).toBe(400);
  });

  it('two editors cannot silently overwrite each other: the second save is told and shown the current record', async () => {
    const act = await json<StaffActivity>(await postA(cEditorA, '/activities', activityBody({ titleEn: 'Contested' })));
    const mine = activityBody({ titleEn: 'First editor wins', schedule: weekly });
    const first = await audited('POST /api/staff/p/:slug/activities/:id', 'staff.activity.updated', A, B, async () => postA(cEditorA, `/activities/${act.id}`, { ...mine, version: act.version }));
    expect(first.status).toBe(200);
    const second = await postA(cAdminA, `/activities/${act.id}`, { ...activityBody({ titleEn: 'Second editor' }), version: act.version });
    expect(second.status).toBe(409);
    const body = await json<{ error: string; current: StaffActivity }>(second);
    expect(body.error).toBe('conflict');
    expect(body.current.title.en).toBe('First editor wins'); // the record as it is now, to show next to the second editor's version
    expect(body.current.version).toBe(act.version + 1);
    expect((await json<StaffActivity[]>(await getA(cAdminA, '/activities'))).find((a) => a.id === act.id)?.title.en).toBe('First editor wins');
    // Retrying against the current version goes through.
    const retry = await postA(cAdminA, `/activities/${act.id}`, { ...activityBody({ titleEn: 'Second editor, after seeing it' }), version: body.current.version });
    expect(retry.status).toBe(200);
  });

  it('cancel one date, restore it, cancel the series, duplicate: each audited, and guests see the change', async () => {
    const act = await json<StaffActivity>(await postA(cEditorA, '/activities', activityBody({ titleEn: 'Weekly yoga' })));
    const cancelled = await audited('POST /api/staff/p/:slug/activities/:id/cancel-date', 'staff.activity.date_cancelled', A, B, async () => postA(cEditorA, `/activities/${act.id}/cancel-date`, { date: '2026-11-03' }));
    expect((await json<StaffActivity>(cancelled)).cancelledDates).toEqual(['2026-11-03']);
    expect((await postA(cEditorA, `/activities/${act.id}/cancel-date`, { date: '2026-11-03' })).status).toBe(409);
    expect((await postA(cEditorA, `/activities/${act.id}/cancel-date`, { date: 'tomorrow' })).status).toBe(400);
    const guest = await json<{ id: string; cancelledDates: string[]; status: string }[]>(await call('/api/p/sc-a/activities', { host: A.host }));
    expect(guest.find((g) => g.id === act.id)?.cancelledDates).toEqual(['2026-11-03']);
    await audited('POST /api/staff/p/:slug/activities/:id/restore-date', 'staff.activity.date_restored', A, B, async () => postA(cEditorA, `/activities/${act.id}/restore-date`, { date: '2026-11-03' }));
    expect((await postA(cEditorA, `/activities/${act.id}/restore-date`, { date: '2026-11-03' })).status).toBe(404);
    const v = (await json<StaffActivity>(await getA(cEditorA, '/activities').then((r) => r))) as unknown;
    expect(v).toBeTruthy();
    const current = (await json<StaffActivity[]>(await getA(cEditorA, '/activities'))).find((a) => a.id === act.id) as StaffActivity;
    const series = await audited('POST /api/staff/p/:slug/activities/:id/status', 'staff.activity.status_changed', A, B, async () => postA(cEditorA, `/activities/${act.id}/status`, { status: 'cancelled', version: current.version }));
    expect((await json<StaffActivity>(series)).status).toBe('cancelled');
    expect((await json<{ id: string; status: string }[]>(await call('/api/p/sc-a/activities', { host: A.host }))).find((g) => g.id === act.id)?.status).toBe('cancelled');
    const copy = await audited('POST /api/staff/p/:slug/activities/:id/duplicate', 'staff.activity.duplicated', A, B, async () => postA(cEditorA, `/activities/${act.id}/duplicate`));
    const dup = await json<StaffActivity>(copy);
    expect(dup.title.en).toBe('Weekly yoga (copy)');
    expect(dup.title.fr).toBe('Quiz (copie)');
    expect(dup.id).not.toBe(act.id);
    expect(dup.status).toBe('active'); // a copy starts as a normal, active activity
  });

  it('an unknown id, an id of another property and a malformed id are all the same 404 or 400', async () => {
    const actB = await json<StaffActivity>(await send(cAdminB, 'sc-b', 'POST', '/activities', activityBody({ titleEn: 'Only for hostel B' })));
    for (const path of [`/activities/${actB.id}`, `/activities/${'0'.repeat(32)}`]) {
      const res = await postA(cAdminA, path, { ...activityBody(), version: 1 });
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect((await postA(cAdminA, '/activities/not-an-id', { ...activityBody(), version: 1 })).status).toBe(400);
    expect((await postA(cAdminA, `/activities/${actB.id}/reverify`, { version: 1 })).status).toBe(404);
    expect((await postA(cAdminA, `/activities/${actB.id}/delete`, { version: 1 })).status).toBe(404);
    expect((await postA(cAdminA, `/activities/${actB.id}/cancel-date`, { date: '2026-11-03' })).status).toBe(404);
    expect((await send(cAdminB, 'sc-b', 'GET', '/activities')).status).toBe(200);
  });
});

describe('a shared activity (D-23) over HTTP', () => {
  let shared: StaffActivity;

  beforeAll(async () => {
    const made = await json<StaffActivity>(await postA(cAdminAB, '/activities', activityBody({ titleEn: 'Shared hike', zoneId: zoneA })));
    const withB = await audited('POST /api/staff/p/:slug/activities/:id/offered-at/add', 'staff.activity.offered_at_added', A, B, async () => postA(cAdminAB, `/activities/${made.id}/offered-at/add`, { slug: 'sc-b' }));
    shared = await json<StaffActivity>(withB);
  });

  it('the owner\'s admin sees the list; B sees the same record but cannot change the list, the zone or delete it', async () => {
    expect(shared.offeredAt.map((o) => o.slug)).toEqual(['sc-a', 'sc-b']);
    expect(shared).toMatchObject({ isOwner: true, canChangeList: true });
    const seenByB = (await json<StaffActivity[]>(await send(cAdminB, 'sc-b', 'GET', '/activities'))).find((a) => a.id === shared.id) as StaffActivity;
    expect(seenByB).toMatchObject({ isOwner: false, canChangeList: false, title: shared.title });
    const asB = (path: string, body: unknown) => send(cAdminB, 'sc-b', 'POST', path, body);
    expect((await asB(`/activities/${shared.id}/delete`, { version: seenByB.version })).status).toBe(403);
    expect((await asB(`/activities/${shared.id}/offered-at/remove`, { slug: 'sc-a' })).status).toBe(403);
    expect((await asB(`/activities/${shared.id}/offered-at/add`, { slug: 'sc-b' })).status).toBe(403);
    expect((await send(cAdminB, 'sc-b', 'GET', `/activities/${shared.id}/offered-at/options`)).status).toBe(403);
    expect((await asB(`/activities/${shared.id}`, { ...activityBody({ zoneId: null }), version: seenByB.version })).status).toBe(403); // owner_only
    expect(await (await asB(`/activities/${shared.id}`, { ...activityBody({ zoneId: null }), version: seenByB.version })).json()).toEqual({ error: 'owner_only' });
  });

  it('B\'s staff may edit the content; the edit is audited under B, stamped with B\'s person, and is one record for both', async () => {
    const seenByB = (await json<StaffActivity[]>(await send(cEditorB, 'sc-b', 'GET', '/activities'))).find((a) => a.id === shared.id) as StaffActivity;
    const edited = await audited('POST /api/staff/p/:slug/activities/:id (as the other offering property)', 'staff.activity.updated', B, A, async () =>
      send(cEditorB, 'sc-b', 'POST', `/activities/${shared.id}`, { ...activityBody({ titleEn: 'Shared hike, new time', schedule: { kind: 'weekly', weekday: 4, startLocal: '10:00', endLocal: null }, zoneId: zoneA }), version: seenByB.version }));
    expect(edited.status).toBe(200);
    expect(await json<StaffActivity>(edited)).toMatchObject({ verifiedBy: 'Bo Editor', isOwner: false });
    const seenByA = (await json<StaffActivity[]>(await getA(cAdminAB, '/activities'))).find((a) => a.id === shared.id) as StaffActivity;
    expect(seenByA.title.en).toBe('Shared hike, new time');
    expect(seenByA.zoneId).toBe(zoneA); // unchanged: the owner's
    // Both properties' guests see the same one record.
    const guestA = await json<{ id: string; title: { en: string } }[]>(await call('/api/p/sc-a/activities', { host: A.host }));
    const guestB = await json<{ id: string; title: { en: string } }[]>(await call('/api/p/sc-b/activities', { host: B.host }));
    expect(guestA.find((g) => g.id === shared.id)?.title.en).toBe('Shared hike, new time');
    expect(guestB.find((g) => g.id === shared.id)?.title.en).toBe('Shared hike, new time');
    shared = seenByA;
  });

  it('the picker offers only properties where the admin also holds a role; adding needs that role too', async () => {
    const opts = await json<{ slug: string }[]>(await getA(cAdminAB, `/activities/${shared.id}/offered-at/options`));
    expect(opts).toEqual([]); // adminAB has roles at A and B only, and both are already listed
    // adminA has no role at B: B is not offered and cannot be added (404, the same as an unknown slug).
    const mineOnly = await json<StaffActivity>(await postA(cAdminA, '/activities', activityBody({ titleEn: 'A only' })));
    expect(await json<{ slug: string }[]>(await getA(cAdminA, `/activities/${mineOnly.id}/offered-at/options`))).toEqual([]);
    const probe = await postA(cAdminA, `/activities/${mineOnly.id}/offered-at/add`, { slug: 'sc-b' });
    const unknown = await postA(cAdminA, `/activities/${mineOnly.id}/offered-at/add`, { slug: 'no-such-hostel' });
    expect(probe.status).toBe(404);
    expect(await probe.text()).toBe(await unknown.text());
    // adminAB created it and holds a role at B, so B is offered for their own A-only activity.
    const theirs = await json<StaffActivity>(await postA(cAdminAB, '/activities', activityBody({ titleEn: 'AB only' })));
    expect((await json<{ slug: string }[]>(await getA(cAdminAB, `/activities/${theirs.id}/offered-at/options`))).map((o) => o.slug)).toEqual(['sc-b']);
  });

  it('removing a property from the list takes the activity from it at once; the owner cannot be removed; the owner can delete', async () => {
    const removed = await audited('POST /api/staff/p/:slug/activities/:id/offered-at/remove', 'staff.activity.offered_at_removed', A, B, async () => postA(cAdminAB, `/activities/${shared.id}/offered-at/remove`, { slug: 'sc-b' }));
    expect((await json<StaffActivity>(removed)).offeredAt.map((o) => o.slug)).toEqual(['sc-a']);
    expect((await json<StaffActivity[]>(await send(cAdminB, 'sc-b', 'GET', '/activities'))).some((a) => a.id === shared.id)).toBe(false);
    expect((await postA(cAdminAB, `/activities/${shared.id}/offered-at/remove`, { slug: 'sc-a' })).status).toBe(409);
    expect((await postA(cAdminAB, `/activities/${shared.id}/offered-at/remove`, { slug: 'sc-b' })).status).toBe(409); // no longer listed
    const current = (await json<StaffActivity[]>(await getA(cAdminAB, '/activities'))).find((a) => a.id === shared.id) as StaffActivity;
    expect((await postA(cEditorA, `/activities/${shared.id}/delete`, { version: current.version })).status).toBe(403); // an editor cannot delete
    expect((await postA(cAdminAB, `/activities/${shared.id}/delete`, { version: current.version + 5 })).status).toBe(409);
    const gone = await audited('POST /api/staff/p/:slug/activities/:id/delete', 'staff.activity.deleted', A, B, async () => postA(cAdminAB, `/activities/${shared.id}/delete`, { version: current.version }));
    expect(await gone.json()).toEqual({ ok: true });
    expect((await json<StaffActivity[]>(await getA(cAdminAB, '/activities'))).some((a) => a.id === shared.id)).toBe(false);
  });
});

describe('places and offers', () => {
  it('place: sorted oldest check first, overdue marked, deleted only by an admin and only with the right version', async () => {
    const mk = async (name: string) => json<StaffPlace>(await postA(cEditorA, '/places', placeBody({ name })));
    const p1 = await mk('Aged place');
    await env.DB.prepare('UPDATE places SET verified_on = ?2 WHERE id = ?1').bind(p1.id, Math.floor(Date.now() / 1000) - 100 * 24 * 3600).run();
    const p2 = await mk('Fresh place');
    const list = await json<StaffPlace[]>(await getA(cEditorA, '/places'));
    expect(list.findIndex((p) => p.id === p1.id)).toBeLessThan(list.findIndex((p) => p.id === p2.id));
    expect(list.find((p) => p.id === p1.id)?.check).toBe('overdue');
    expect(list.find((p) => p.id === p2.id)?.check).toBe('ok');
    for (const p of list) expect(Object.keys(p).sort()).toEqual([...STAFF_FIELDS.place].sort());
    expect((await postA(cEditorA, `/places/${p2.id}/delete`, { version: p2.version })).status).toBe(403);
    expect((await postA(cAdminA, `/places/${p2.id}/delete`, { version: 99 })).status).toBe(409);
    await audited('POST /api/staff/p/:slug/places/:id/delete', 'staff.place.deleted', A, B, async () => postA(cAdminA, `/places/${p2.id}/delete`, { version: p2.version }));
    expect((await postA(cAdminA, `/places/${p2.id}/delete`, { version: p2.version })).status).toBe(404);
  });

  it('place concurrency: the second save is told, with the current record', async () => {
    const p = await json<StaffPlace>(await postA(cEditorA, '/places', placeBody({ name: 'Contested place' })));
    expect((await postA(cEditorA, `/places/${p.id}`, { ...placeBody({ name: 'First' }), version: p.version })).status).toBe(200);
    const second = await postA(cAdminA, `/places/${p.id}`, { ...placeBody({ name: 'Second' }), version: p.version });
    expect(second.status).toBe(409);
    expect((await json<{ current: StaffPlace }>(second)).current.name).toBe('First');
  });

  it('offer: validity is in the property\'s days, guests see it only while shown, and an expired one is flagged for staff', async () => {
    const live = await json<StaffOffer>(await postA(cEditorA, '/offers', offerBody({ validFrom: '2026-01-01', validTo: '2099-12-31' })));
    expect(live).toMatchObject({ validFrom: '2026-01-01', validTo: '2099-12-31', guestState: 'shown' });
    const old = await json<StaffOffer>(await postA(cEditorA, '/offers', offerBody({ partnerName: 'Old deal', validFrom: '2020-01-01', validTo: '2020-02-01' })));
    expect(old.guestState).toBe('expired');
    const future = await json<StaffOffer>(await postA(cEditorA, '/offers', offerBody({ partnerName: 'Soon', validFrom: '2098-01-01', validTo: null })));
    expect(future.guestState).toBe('not_started');
    const guest = await json<{ id: string }[]>(await call('/api/p/sc-a/offers', { host: A.host }));
    expect(guest.some((g) => g.id === live.id)).toBe(true);
    expect(guest.some((g) => g.id === old.id)).toBe(false);
    expect(guest.some((g) => g.id === future.id)).toBe(false);
    expect((await postA(cEditorA, '/offers', offerBody({ validFrom: '2026-05-01', validTo: '2026-04-01' }))).status).toBe(400);
    expect((await postA(cEditorA, '/offers', offerBody({ validFrom: 'soon' }))).status).toBe(400);
    const all = await json<Record<string, unknown>[]>(await getA(cEditorA, '/offers'));
    for (const o of all) expect(Object.keys(o).sort()).toEqual([...STAFF_FIELDS.offer].sort());
    const re = await audited('POST /api/staff/p/:slug/offers/:id/reverify', 'staff.offer.reverified', A, B, async () => postA(cEditorA, `/offers/${old.id}/reverify`, { version: old.version }));
    expect((await json<StaffOffer>(re)).version).toBe(old.version + 1);
    const upd = await audited('POST /api/staff/p/:slug/offers/:id', 'staff.offer.updated', A, B, async () => postA(cEditorA, `/offers/${live.id}`, { ...offerBody({ partnerName: 'Renamed Co', validFrom: '2026-01-01', validTo: '2099-12-31' }), version: live.version }));
    expect((await json<StaffOffer>(upd)).partnerName).toBe('Renamed Co');
    await audited('POST /api/staff/p/:slug/offers/:id/delete', 'staff.offer.deleted', A, B, async () => postA(cAdminA, `/offers/${future.id}/delete`, { version: future.version }));
  });
});

describe('zones, QR labels, switches', () => {
  it('zones: admin writes, an editor reads; one in use cannot be removed; a stale version is told', async () => {
    expect((await getA(cEditorA, '/zones')).status).toBe(200);
    expect((await postA(cEditorA, '/zones', { labelEn: 'Nope', labelFr: '', ring: 'further' })).status).toBe(403);
    const z = await json<StaffZone>(await audited('POST /api/staff/p/:slug/zones', 'staff.zone.created', A, B, async () => postA(cAdminA, '/zones', { labelEn: 'Deck', labelFr: 'Terrasse', ring: 'in_hostel' })));
    expect(Object.keys(z).sort()).toEqual([...STAFF_FIELDS.zone].sort());
    const upd = await audited('POST /api/staff/p/:slug/zones/:id', 'staff.zone.updated', A, B, async () => postA(cAdminA, `/zones/${z.id}`, { labelEn: 'Roof deck', labelFr: 'Toit', ring: 'short_walk', version: z.version }));
    expect(await json<StaffZone>(upd)).toMatchObject({ ring: 'short_walk', version: z.version + 1 });
    const stale = await postA(cAdminA, `/zones/${z.id}`, { labelEn: 'x', labelFr: '', ring: 'further', version: z.version });
    expect(stale.status).toBe(409);
    expect((await postA(cAdminA, `/zones/${zoneA}/delete`, { version: 1 })).status).toBe(409); // an activity uses it
    expect((await postA(cAdminA, `/zones/${zoneA}/delete`, { version: 1 }).then((r) => r.json()))).toEqual({ error: 'in_use' });
    await audited('POST /api/staff/p/:slug/zones/:id/delete', 'staff.zone.deleted', A, B, async () => postA(cAdminA, `/zones/${z.id}/delete`, { version: z.version + 1 }));
  });

  it('QR labels: an editor can see them, an admin creates and retires them; labels are lower-case words', async () => {
    expect((await getA(cEditorA, '/codes')).status).toBe(200);
    expect((await postA(cEditorA, '/codes', { label: 'desk' })).status).toBe(403);
    const list = await json<{ id: string; label: string; retiredAt: number | null }[]>(
      await audited('POST /api/staff/p/:slug/codes', 'staff.code.created', A, B, async () => postA(cAdminA, '/codes', { label: ' Common-Room ' })),
    );
    expect(list.map((c) => c.label)).toContain('common-room');
    expect((await postA(cAdminA, '/codes', { label: 'common-room' })).status).toBe(409);
    expect((await postA(cAdminA, '/codes', { label: 'has space' })).status).toBe(400);
    expect((await postA(cAdminA, '/codes', { label: 'x'.repeat(41) })).status).toBe(400);
    expect((await send(cAdminB, 'sc-b', 'POST', '/codes', { label: 'common-room' })).status).toBe(200); // the same label elsewhere is fine
    const id = list.find((c) => c.label === 'common-room')?.id as string;
    const retired = await audited('POST /api/staff/p/:slug/codes/:id/retire', 'staff.code.retired', A, B, async () => postA(cAdminA, `/codes/${id}/retire`));
    expect((await json<{ id: string; retiredAt: number | null }[]>(retired)).find((c) => c.id === id)?.retiredAt).not.toBeNull();
    expect((await postA(cAdminA, `/codes/${id}/retire`)).status).toBe(404);
    expect(JSON.stringify(list)).not.toMatch(/token/i);
  });

  it('feature switches: default off, admin only, audited, and the guest app follows', async () => {
    expect(await json(await getA(cEditorA, '/features'))).toEqual({ common_room: false, connect: false });
    expect((await postA(cEditorA, '/features/common_room', { enabled: true })).status).toBe(403);
    expect((await postA(cAdminA, '/features/radar', { enabled: true })).status).toBe(400);
    expect((await postA(cAdminA, '/features/common_room', { enabled: 'yes' })).status).toBe(400);
    const on = await audited('POST /api/staff/p/:slug/features/:name', 'staff.feature.enabled', A, B, async () => postA(cAdminA, '/features/common_room', { enabled: true }));
    expect(await json(on)).toEqual({ common_room: true, connect: false });
    expect(((await json<{ features: Record<string, boolean> }>(await call('/api/p/sc-a/config', { host: A.host }))).features)).toEqual({ common_room: true, connect: false });
    expect(((await json<{ features: Record<string, boolean> }>(await call('/api/p/sc-b/config', { host: B.host }))).features)).toEqual({ common_room: false, connect: false });
    await postA(cAdminA, '/features/common_room', { enabled: false });
    expect(await json(await getA(cAdminA, '/features'))).toEqual({ common_room: false, connect: false });
  });
});

describe('audit log and export', () => {
  it('the audit log is admin only, newest first, this property only, filterable and paged', async () => {
    expect((await getA(cEditorA, '/audit')).status).toBe(403);
    const all = await json<{ id: string; action: string; actorName: string | null; createdAt: number }[]>(await getA(cAdminA, '/audit?limit=200'));
    expect(all.length).toBeGreaterThan(5);
    for (const row of all) expect(Object.keys(row).sort()).toEqual([...STAFF_FIELDS.audit].sort());
    expect(all.map((r) => r.createdAt)).toEqual(all.map((r) => r.createdAt).toSorted((x, y) => y - x));
    expect(all.some((r) => r.actorName === 'Eli Editor')).toBe(true);
    const onlyZone = await json<{ action: string }[]>(await getA(cAdminA, '/audit?action=staff.zone.created'));
    expect(onlyZone.length).toBeGreaterThan(0);
    expect(onlyZone.every((r) => r.action === 'staff.zone.created')).toBe(true);
    const page = await json<{ createdAt: number }[]>(await getA(cAdminA, '/audit?limit=3'));
    expect(page.length).toBe(3);
    // B's log never holds A's staff, and A's never B's.
    const bLog = await json<{ actorName: string | null }[]>(await send(cAdminB, 'sc-b', 'GET', '/audit?limit=200'));
    expect(bLog.some((r) => r.actorName === 'Eli Editor')).toBe(false);
    expect((await getA(cAdminA, '/audit?limit=abc')).status).toBe(400);
    expect((await getA(cAdminA, '/audit?action=DROP TABLE')).status).toBe(400);
  });

  it('the export is admin only, one file, this property\'s content, no staff and no other property', async () => {
    expect((await postA(cEditorA, '/export')).status).toBe(403);
    const res = await audited('POST /api/staff/p/:slug/export', 'staff.export', A, B, async () => postA(cAdminA, '/export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="sc-a-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await res.text();
    const file = JSON.parse(text) as { property: { slug: string }; zones: unknown[]; activities: unknown[]; places: unknown[]; offers: unknown[]; qrLabels: unknown[] };
    expect(file.property.slug).toBe('sc-a');
    expect(file.zones.length).toBeGreaterThan(0);
    expect(file.activities.length).toBeGreaterThan(0);
    expect(file.places.length).toBeGreaterThan(0);
    expect(file.offers.length).toBeGreaterThan(0);
    expect(file.qrLabels.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/@sc\.test/); // no staff emails
    expect(text).not.toContain(A.id);
    expect(text).not.toContain(B.id);
    expect(text).not.toMatch(/Bea Admin|Bo Editor/);
    expect(text).not.toContain('Only for hostel B'); // another property's own activity
  });
});

describe('text staff type is data, not markup', () => {
  const payloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><svg/onload=alert(1)>', "'; DROP TABLE activities; --", '{{7*7}} ${7*7} `x`', '</title><b>bold</b>', 'javascript:alert(1)', '&lt;b&gt; &amp;'];

  it.each(payloads)('%s is stored and returned verbatim in every text field, as JSON, under the strict CSP', async (payload) => {
    const slug = `xss-${Math.abs([...payload].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7))}`;
    const P = await makeProperty(env.DB, slug, { host: `${slug}.test` });
    const person = await makeStaff(env.DB, `${slug}@x.test`, [{ propertyId: P.id, role: 'admin' }]);
    await nameStaff(env.DB, person, 'Pat');
    const cookie = await sessionCookieFor(env.DB, person);
    const go = (path: string, body: unknown) => call(`/api/staff/p/${slug}${path}`, { host: P.host, method: 'POST', headers: { Cookie: cookie }, body });
    const zone = await json<StaffZone>(await go('/zones', { labelEn: payload.slice(0, 80), labelFr: payload.slice(0, 80), ring: 'in_hostel' }));
    await go('/activities', activityBody({ titleEn: payload, titleFr: payload, descriptionEn: payload, descriptionFr: payload, hostLabel: payload.slice(0, 80), zoneId: zone.id }));
    await go('/places', placeBody({ name: payload, noteEn: payload, noteFr: payload, walkTimeEn: payload, walkTimeFr: payload, hoursEn: payload, hoursFr: payload, phone: payload.slice(0, 30), mapsAddress: payload }));
    await go('/offers', offerBody({ partnerName: payload, termsEn: payload, termsFr: payload, howWeKnowEn: payload, howWeKnowFr: payload }));
    for (const path of ['activities', 'places', 'offers']) {
      const res = await call(`/api/p/${slug}/${path}`, { host: P.host });
      expect(res.headers.get('Content-Type')).toMatch(/^application\/json/);
      expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      const raw = await res.text();
      expect(raw.length).toBeGreaterThan(10);
      const decoded = JSON.parse(raw) as Record<string, unknown>[];
      const flat = JSON.stringify(decoded);
      expect(flat).toContain(JSON.stringify(payload).slice(1, -1)); // the exact text came back, unescaped by us, unaltered
      expect(decoded.length).toBe(1);
    }
    // Offers are only shown once checked: the staff view returns the exact text too.
    const mine = await json<StaffOffer[]>(await call(`/api/staff/p/${slug}/offers`, { host: P.host, headers: { Cookie: cookie } }));
    expect(mine[0]?.partnerName).toBe(payload);
    expect(mine[0]?.terms.en).toBe(payload);
  });
});

describe('every property-scoped staff route is covered by the role matrix', () => {
  it('(the matrix file lists them all; this keeps the two in step)', async () => {
    const routes = createApp().routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api/staff/p/')).map((r) => `${r.method} ${r.path}`);
    expect(new Set(routes).size).toBeGreaterThan(35);
  });
});
