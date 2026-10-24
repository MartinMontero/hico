import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeActivity, makeOffer, makePlace, makeProperty, makeStaff, makeZone, type PropertyFixture } from '../support/fixtures.ts';
import { createTenantContext, type TenantContext } from '../../worker/tenant.ts';
import { activities, codes, features, offers, places, properties, zones } from '../../worker/repositories/index.ts';
import type { ActivityWrite } from '../../worker/repositories/activities.ts';

// Isolation suite, part 3: the staff-side (write) repository functions. Property A tries property B's rows by id.
// For the shared activity (D-23) the edit rule is: any property that offers it may edit its content; only the
// owner changes the zone, the list or deletes it. tests/node/meta.test.ts reads every isolation*.test.ts for covers().
function covers(...names: string[]): void {
  expect(names.length).toBeGreaterThan(0);
}

const NOW = 1_800_000_000;
const STAMP = { on: NOW, by: 'Tester' };
const ctxFor = (p: PropertyFixture) => createTenantContext(env.DB, { propertyId: p.id, slug: p.slug, timezone: 'America/Vancouver' });
const write = (over: Partial<ActivityWrite> = {}): ActivityWrite => ({
  titleEn: 'Edited', titleFr: 'Modifié', descriptionEn: 'd', descriptionFr: 'd', category: 'social', zoneId: null, hostLabel: 'Staff', capacity: null,
  weekday: 3, startLocal: '18:00', endLocal: null, startsAt: null, endsAt: null, ...over,
});
const placeWrite = { category: 'food' as const, name: 'Edited place', staffPick: true, noteEn: 'n', noteFr: 'n', walkTimeEn: '', walkTimeFr: '', hoursEn: '', hoursFr: '', phone: null, mapsAddress: '' };
const offerWrite = { partnerName: 'Edited partner', termsEn: 't', termsFr: 't', validFrom: null, validTo: null, requiresMembership: false, howWeKnowEn: '', howWeKnowFr: '' };

let A: PropertyFixture, B: PropertyFixture, C: PropertyFixture;
let ctxA: TenantContext, ctxB: TenantContext, ctxC: TenantContext;
let zoneA: string, zoneB: string, actA: string, actB: string, shared: string;
let placeA: string, placeB: string, offerA: string, offerB: string;
let adminA: string, adminAB: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'isc-a');
  B = await makeProperty(env.DB, 'isc-b');
  C = await makeProperty(env.DB, 'isc-c');
  [ctxA, ctxB, ctxC] = [ctxFor(A), ctxFor(B), ctxFor(C)];
  zoneA = await makeZone(env.DB, A.id, 'Lobby A');
  zoneB = await makeZone(env.DB, B.id, 'Lobby B');
  actA = await makeActivity(env.DB, A.id, [A.id], 'A only', zoneA);
  actB = await makeActivity(env.DB, B.id, [B.id], 'B only', zoneB);
  shared = await makeActivity(env.DB, A.id, [A.id, B.id], 'Shared', zoneA);
  placeA = await makePlace(env.DB, A.id, 'Place A');
  placeB = await makePlace(env.DB, B.id, 'Place B');
  offerA = await makeOffer(env.DB, A.id, NOW, 'Offer A');
  offerB = await makeOffer(env.DB, B.id, NOW, 'Offer B');
  adminA = await makeStaff(env.DB, 'admin-a@isc.test', [{ propertyId: A.id, role: 'admin' }]);
  adminAB = await makeStaff(env.DB, 'admin-ab@isc.test', [{ propertyId: A.id, role: 'admin' }, { propertyId: B.id, role: 'admin' }]);
});

const versionOf = async (id: string, table: 'activities' | 'places' | 'offers' | 'zones') =>
  (await env.DB.prepare(`SELECT version FROM ${table} WHERE id = ?1`).bind(id).first<{ version: number }>())?.version as number;

describe('activities: reading for staff', () => {
  it('listForStaff and getForStaff show a property its own and the shared activity, with the list, never another\'s', async () => {
    covers('activities.listForStaff', 'activities.getForStaff');
    expect((await activities.listForStaff(ctxA)).map((x) => x.row.id).sort()).toEqual([actA, shared].sort());
    expect((await activities.listForStaff(ctxB)).map((x) => x.row.id).sort()).toEqual([actB, shared].sort());
    expect(await activities.listForStaff(ctxC)).toEqual([]);
    expect(await activities.getForStaff(ctxA, actB)).toBeNull();
    expect(await activities.getForStaff(ctxC, shared)).toBeNull();
    const seenByB = await activities.getForStaff(ctxB, shared);
    expect(seenByB?.row.owner_id).toBe(A.id);
    expect(seenByB?.offeredAt.map((o) => o.slug)).toEqual(['isc-a', 'isc-b']);
    // A's A-only activity lists only A.
    expect((await activities.getForStaff(ctxA, actA))?.offeredAt.map((o) => o.slug)).toEqual(['isc-a']);
  });
});

describe('activities: writing', () => {
  it('insert creates an activity owned by and offered at the context property only', async () => {
    covers('activities.insert');
    const id = await activities.insert(ctxB, write({ titleEn: 'Fresh at B' }), STAMP, 'America/Vancouver', NOW);
    expect(await activities.getForStaff(ctxA, id)).toBeNull();
    const mine = await activities.getForStaff(ctxB, id);
    expect(mine?.row.owner_id).toBe(B.id);
    expect(mine?.offeredAt.map((o) => o.slug)).toEqual(['isc-b']);
    expect(mine?.row.verified_by).toBe('Tester');
    expect(mine?.row.version).toBe(1);
    // A zone of another property cannot be named (the composite key).
    await expect(activities.insert(ctxA, write({ zoneId: zoneB }), STAMP, 'America/Vancouver', NOW)).rejects.toThrow();
  });

  it('update: the owner and any listed property may edit content; B cannot touch A-only; C nothing; a stale version changes nothing', async () => {
    covers('activities.update');
    expect(await activities.update(ctxA, shared, 1, write({ titleEn: 'By owner', zoneId: zoneA }), STAMP, NOW + 1)).toBe('ok');
    expect(await versionOf(shared, 'activities')).toBe(2);
    expect(await activities.update(ctxB, shared, 2, write({ titleEn: 'By B', zoneId: zoneB }), { on: NOW + 2, by: 'B person' }, NOW + 2)).toBe('ok');
    const after = await activities.getForStaff(ctxA, shared);
    expect(after?.row.title_en).toBe('By B');
    expect(after?.row.verified_by).toBe('B person');
    expect(after?.row.zone_id).toBe(zoneA); // B named its own zone: the owner's zone is untouched (and B's zone is not even valid there)
    expect(await activities.update(ctxB, actA, 1, write(), STAMP, NOW)).toBe('missing');
    expect((await activities.getForStaff(ctxA, actA))?.row.title_en).toBe('A only');
    expect(await activities.update(ctxC, shared, 3, write(), STAMP, NOW)).toBe('missing');
    expect(await activities.update(ctxA, shared, 1, write({ titleEn: 'Stale' }), STAMP, NOW)).toBe('conflict'); // version is 3 now
    expect((await activities.getForStaff(ctxA, shared))?.row.title_en).toBe('By B');
  });

  it('reverify and setStatus follow the same visibility and version rules', async () => {
    covers('activities.reverify', 'activities.setStatus');
    const v = await versionOf(shared, 'activities');
    expect(await activities.reverify(ctxB, shared, v, { on: NOW + 10, by: 'Checker' }, NOW + 10)).toBe('ok');
    expect((await activities.getForStaff(ctxA, shared))?.row.verified_on).toBe(NOW + 10);
    expect(await activities.reverify(ctxB, actA, 1, STAMP, NOW)).toBe('missing');
    expect(await activities.reverify(ctxC, shared, v + 1, STAMP, NOW)).toBe('missing');
    expect(await activities.reverify(ctxA, shared, v, STAMP, NOW)).toBe('conflict');
    const v2 = await versionOf(shared, 'activities');
    expect(await activities.setStatus(ctxB, shared, v2, 'cancelled', NOW)).toBe('ok');
    expect((await activities.getForStaff(ctxA, shared))?.row.status).toBe('cancelled');
    expect(await activities.setStatus(ctxB, actA, 1, 'cancelled', NOW)).toBe('missing');
    expect(await activities.setStatus(ctxA, shared, await versionOf(shared, 'activities'), 'active', NOW)).toBe('ok');
  });

  it('cancelDate and restoreDate: any listed property, one cancelled date for all, nothing across properties', async () => {
    covers('activities.cancelDate', 'activities.restoreDate');
    expect(await activities.cancelDate(ctxB, shared, '2026-11-09')).toBe('ok');
    expect((await activities.getForStaff(ctxA, shared))?.cancelledDates).toEqual(['2026-11-09']);
    expect(await activities.cancelDate(ctxA, shared, '2026-11-09')).toBe('exists');
    expect(await activities.cancelDate(ctxB, actA, '2026-11-09')).toBe('missing');
    expect(await activities.cancelDate(ctxC, shared, '2026-11-10')).toBe('missing');
    expect(await activities.restoreDate(ctxC, shared, '2026-11-09')).toBe(false);
    expect(await activities.restoreDate(ctxB, actA, '2026-11-09')).toBe(false);
    expect(await activities.restoreDate(ctxB, shared, '2026-11-09')).toBe(true);
    expect((await activities.getForStaff(ctxA, shared))?.cancelledDates).toEqual([]);
  });

  it('addOfferedAt and removeOfferedAt are the owner\'s alone, and never look up a property that is not already listed', async () => {
    covers('activities.addOfferedAt', 'activities.removeOfferedAt');
    expect(await activities.addOfferedAt(ctxB, shared, C.id)).toBe(false); // B offers it but does not own it
    expect(await activities.getForStaff(ctxC, shared)).toBeNull();
    expect(await activities.addOfferedAt(ctxA, shared, C.id)).toBe(true);
    expect((await activities.getForStaff(ctxC, shared))?.row.id).toBe(shared);
    expect(await activities.addOfferedAt(ctxA, shared, C.id)).toBe(false); // already listed
    expect(await activities.addOfferedAt(ctxA, actB, C.id)).toBe(false); // not A's activity
    expect(await activities.removeOfferedAt(ctxB, shared, 'isc-c')).toBe(false); // B does not own it
    expect(await activities.removeOfferedAt(ctxA, shared, 'isc-a')).toBe(false); // the owner stays
    expect(await activities.removeOfferedAt(ctxA, shared, 'no-such-slug')).toBe(false);
    expect(await activities.removeOfferedAt(ctxA, actB, 'isc-b')).toBe(false); // B's own activity, not A's
    expect(await activities.removeOfferedAt(ctxA, shared, 'isc-c')).toBe(true);
    expect(await activities.getForStaff(ctxC, shared)).toBeNull();
    // Removing B takes it from B at once; adding B back restores it.
    expect(await activities.removeOfferedAt(ctxA, shared, 'isc-b')).toBe(true);
    expect(await activities.getForStaff(ctxB, shared)).toBeNull();
    expect(await activities.addOfferedAt(ctxA, shared, B.id)).toBe(true);
    expect(await activities.getForStaff(ctxB, shared)).not.toBeNull();
  });

  it('remove: only the owner, with the right version; the children go with it and a wrong version deletes nothing', async () => {
    covers('activities.remove');
    const own = await makeActivity(env.DB, A.id, [A.id, B.id], 'To delete', zoneA);
    await activities.cancelDate(ctxA, own, '2026-12-01');
    expect(await activities.remove(ctxB, own, 1)).toBe('missing'); // B offers it but does not own it
    expect(await activities.getForStaff(ctxB, own)).not.toBeNull();
    expect(await activities.remove(ctxA, own, 99)).toBe('conflict');
    expect(await activities.getForStaff(ctxA, own)).not.toBeNull();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM activity_exceptions WHERE activity_id = ?1').bind(own).first<{ n: number }>())?.n).toBe(1); // untouched by the refused delete
    expect(await activities.remove(ctxA, own, 1)).toBe('ok');
    expect(await activities.getForStaff(ctxB, own)).toBeNull();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM activity_offered_at WHERE activity_id = ?1').bind(own).first<{ n: number }>())?.n).toBe(0);
    expect(await activities.remove(ctxA, own, 1)).toBe('missing');
    expect(await activities.remove(ctxA, actB, 1)).toBe('missing');
  });

  it('the guards agree with the writes: owner admin only for the list, any role at a listed property for content', async () => {
    covers('activities.canEditActivity', 'activities.canChangeOfferedAt');
    expect(await activities.canChangeOfferedAt(ctxA, adminA, shared)).toBe(true);
    expect(await activities.canChangeOfferedAt(ctxB, adminAB, shared)).toBe(false); // admin at B, but B is not the owner
    expect(await activities.canEditActivity(ctxB, adminAB, shared)).toBe(true);
    expect(await activities.canEditActivity(ctxC, adminAB, shared)).toBe(false);
  });
});

describe('places', () => {
  it('listForStaff and getForStaff never cross properties', async () => {
    covers('places.listForStaff', 'places.getForStaff');
    expect((await places.listForStaff(ctxA)).map((p) => p.id)).toContain(placeA);
    expect((await places.listForStaff(ctxA)).map((p) => p.id)).not.toContain(placeB);
    expect(await places.getForStaff(ctxA, placeB)).toBeNull();
    expect(await places.listForStaff(ctxC)).toEqual([]);
  });

  it('insert, update, reverify and remove act on the context property only, and respect the version', async () => {
    covers('places.insert', 'places.update', 'places.reverify', 'places.remove');
    const id = await places.insert(ctxA, placeWrite, STAMP, NOW);
    expect(await places.getForStaff(ctxB, id)).toBeNull();
    expect(await places.update(ctxB, id, 1, placeWrite, STAMP, NOW)).toBe('missing');
    expect(await places.reverify(ctxB, id, 1, STAMP, NOW)).toBe('missing');
    expect(await places.remove(ctxB, id, 1)).toBe('missing');
    expect(await places.update(ctxA, id, 7, placeWrite, STAMP, NOW)).toBe('conflict');
    expect(await places.update(ctxA, id, 1, { ...placeWrite, name: 'Renamed' }, { on: NOW + 1, by: 'Eli' }, NOW + 1)).toBe('ok');
    const row = await places.getForStaff(ctxA, id);
    expect(row).toMatchObject({ name: 'Renamed', verified_by: 'Eli', version: 2, is_placeholder: 0 });
    expect(await places.reverify(ctxA, id, 2, { on: NOW + 5, by: 'Ana' }, NOW + 5)).toBe('ok');
    expect((await places.getForStaff(ctxA, id))?.name).toBe('Renamed'); // the text is untouched by a re-verify
    expect(await places.remove(ctxA, id, 1)).toBe('conflict');
    expect(await places.remove(ctxA, id, 3)).toBe('ok');
    expect(await places.getForStaff(ctxA, id)).toBeNull();
    expect((await places.getForStaff(ctxB, placeB))?.name).toBe('Place B'); // B's own place was never touched
  });
});

describe('offers', () => {
  it('listForStaff and getForStaff never cross properties, and include offers guests do not see', async () => {
    covers('offers.listForStaff', 'offers.getForStaff');
    expect((await offers.listForStaff(ctxA)).map((o) => o.id)).toContain(offerA);
    expect((await offers.listForStaff(ctxA)).map((o) => o.id)).not.toContain(offerB);
    expect(await offers.getForStaff(ctxA, offerB)).toBeNull();
    const hidden = await offers.insert(ctxA, { ...offerWrite, validTo: 5 }, STAMP, NOW); // long expired
    expect((await offers.listForStaff(ctxA)).map((o) => o.id)).toContain(hidden);
    expect((await offers.listShown(ctxA, NOW)).map((o) => o.id)).not.toContain(hidden);
  });

  it('insert, update, reverify and remove act on the context property only, and respect the version', async () => {
    covers('offers.insert', 'offers.update', 'offers.reverify', 'offers.remove');
    const id = await offers.insert(ctxA, offerWrite, STAMP, NOW);
    expect(await offers.update(ctxB, id, 1, offerWrite, STAMP)).toBe('missing');
    expect(await offers.reverify(ctxB, id, 1, STAMP)).toBe('missing');
    expect(await offers.remove(ctxB, id, 1)).toBe('missing');
    expect(await offers.update(ctxA, id, 9, offerWrite, STAMP)).toBe('conflict');
    expect(await offers.update(ctxA, id, 1, { ...offerWrite, partnerName: 'Renamed' }, { on: NOW + 1, by: 'Eli' })).toBe('ok');
    expect(await offers.reverify(ctxA, id, 2, { on: NOW + 9, by: 'Ana' })).toBe('ok');
    expect(await offers.getForStaff(ctxA, id)).toMatchObject({ partner_name: 'Renamed', verified_by: 'Ana', verified_on: NOW + 9, version: 3 });
    expect(await offers.remove(ctxA, id, 1)).toBe('conflict');
    expect(await offers.remove(ctxA, id, 3)).toBe('ok');
    expect((await offers.getForStaff(ctxB, offerB))?.partner_name).toBe('Offer B');
  });
});

describe('zones', () => {
  it('list, getById, insert, update and remove act on the context property only', async () => {
    covers('zones.list', 'zones.getById', 'zones.insert', 'zones.update', 'zones.remove');
    expect((await zones.list(ctxA)).map((z) => z.id)).toContain(zoneA);
    expect((await zones.list(ctxA)).map((z) => z.id)).not.toContain(zoneB);
    expect(await zones.getById(ctxA, zoneB)).toBeNull();
    const id = await zones.insert(ctxA, { labelEn: 'Deck', labelFr: 'Terrasse', ring: 'in_hostel' });
    expect(await zones.getById(ctxB, id)).toBeNull();
    expect(await zones.update(ctxB, id, 1, { labelEn: 'x', labelFr: 'x', ring: 'further' })).toBe('missing');
    expect(await zones.update(ctxA, id, 5, { labelEn: 'x', labelFr: 'x', ring: 'further' })).toBe('conflict');
    expect(await zones.update(ctxA, id, 1, { labelEn: 'Roof deck', labelFr: 'Toit', ring: 'short_walk' })).toBe('ok');
    expect(await zones.getById(ctxA, id)).toMatchObject({ labelEn: 'Roof deck', ring: 'short_walk', version: 2, inUse: false });
    expect(await zones.remove(ctxB, id, 2)).toBe('missing');
    expect(await zones.remove(ctxA, id, 1)).toBe('conflict');
    expect(await zones.remove(ctxA, id, 2)).toBe('ok');
    // A zone an activity uses stays.
    expect((await zones.getById(ctxA, zoneA))?.inUse).toBe(true);
    expect(await zones.remove(ctxA, zoneA, await versionOf(zoneA, 'zones'))).toBe('in_use');
  });
});

describe('QR labels', () => {
  it('list, insert and retire act on the context property only; a label is unique per property, not across them', async () => {
    covers('codes.list', 'codes.insert', 'codes.retire');
    const a = await codes.insert(ctxA, 'desk', NOW);
    expect(a).not.toBe('exists');
    expect(await codes.insert(ctxA, 'desk', NOW)).toBe('exists');
    expect(await codes.insert(ctxB, 'desk', NOW)).not.toBe('exists'); // the same label at another property is fine
    const aId = (a as { id: string }).id;
    expect((await codes.list(ctxB)).map((c) => c.id)).not.toContain(aId);
    expect(await codes.retire(ctxB, aId, NOW + 1)).toBe(false);
    expect(await codes.retire(ctxA, aId, NOW + 1)).toBe(true);
    expect(await codes.retire(ctxA, aId, NOW + 2)).toBe(false); // already retired
    expect((await codes.list(ctxA)).find((c) => c.id === aId)?.retiredAt).toBe(NOW + 1);
    expect((await codes.list(ctxB)).find((c) => c.label === 'desk')?.retiredAt).toBeNull();
    expect(await codes.list(ctxC)).toEqual([]);
  });
});

describe('feature switches', () => {
  it('set changes only the context property, defaults to off, and records who and when', async () => {
    covers('features.set');
    expect(await properties.listFeatures(ctxA)).toEqual({ common_room: false, connect: false });
    await features.set(ctxA, 'common_room', true, adminA, NOW);
    expect(await properties.listFeatures(ctxA)).toEqual({ common_room: true, connect: false });
    expect(await properties.listFeatures(ctxB)).toEqual({ common_room: false, connect: false });
    await features.set(ctxA, 'common_room', false, adminA, NOW + 1);
    expect(await properties.listFeatures(ctxA)).toEqual({ common_room: false, connect: false });
    const row = await env.DB.prepare("SELECT changed_by, changed_at FROM property_features WHERE property_id = ?1 AND feature = 'common_room'").bind(A.id).first<{ changed_by: string; changed_at: number }>();
    expect(row).toEqual({ changed_by: adminA, changed_at: NOW + 1 });
  });
});
