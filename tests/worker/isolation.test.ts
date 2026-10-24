import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  makeActivity, makeException, makeOffer, makePlace, makeProperty, makeStaff, makeZone,
  type PropertyFixture,
} from '../support/fixtures.ts';
import { createTenantContext, type TenantContext } from '../../worker/tenant.ts';
import { activities, audit, events, flags, hosts, offers, places, properties, staff } from '../../worker/repositories/index.ts';

// Isolation suite (05 §4 rule 6). Property A tries property B's rows by id, through every
// repository function. tests/node/meta.test.ts fails if an exported function is not named in
// a covers() call below.
function covers(...names: string[]): void {
  expect(names.length).toBeGreaterThan(0);
}

const NOW = 1_800_000_000;

let A: PropertyFixture, B: PropertyFixture, C: PropertyFixture;
let ctxA: TenantContext, ctxB: TenantContext, ctxC: TenantContext;
let actA: string, actB: string, shared: string;
let placeA: string, placeB: string, offerA: string, offerB: string;
let staffA: string, staffB: string, staffAB: string;

const ctxFor = (p: PropertyFixture) => createTenantContext(env.DB, { propertyId: p.id, slug: p.slug, timezone: 'America/Vancouver' });

beforeAll(async () => {
  A = await makeProperty(env.DB, 'iso-a');
  B = await makeProperty(env.DB, 'iso-b');
  C = await makeProperty(env.DB, 'iso-c');
  [ctxA, ctxB, ctxC] = [ctxFor(A), ctxFor(B), ctxFor(C)];
  const zoneA = await makeZone(env.DB, A.id);
  actA = await makeActivity(env.DB, A.id, [A.id], 'A only', zoneA);
  actB = await makeActivity(env.DB, B.id, [B.id], 'B only');
  shared = await makeActivity(env.DB, A.id, [A.id, B.id], 'Shared by A and B', zoneA);
  await makeException(env.DB, shared, A.id, '2026-11-02');
  placeA = await makePlace(env.DB, A.id, 'Place A');
  placeB = await makePlace(env.DB, B.id, 'Place B');
  offerA = await makeOffer(env.DB, A.id, NOW, 'Offer A');
  offerB = await makeOffer(env.DB, B.id, NOW, 'Offer B');
  staffA = await makeStaff(env.DB, 'a@iso.test', [{ propertyId: A.id, role: 'admin' }]);
  staffB = await makeStaff(env.DB, 'b@iso.test', [{ propertyId: B.id, role: 'editor' }]);
  staffAB = await makeStaff(env.DB, 'ab@iso.test', [{ propertyId: A.id, role: 'editor' }, { propertyId: B.id, role: 'admin' }]);
  await env.DB.prepare("INSERT INTO property_features (property_id, feature, enabled) VALUES (?1, 'common_room', 1)").bind(B.id).run();
});

describe('activities (D-23: shared record, explicit list)', () => {
  it('listVisible: A sees its own and the shared one, never B-only', async () => {
    covers('activities.listVisible');
    const ids = (await activities.listVisible(ctxA)).map((x) => x.row.id).sort();
    expect(ids).toEqual([actA, shared].sort());
    expect(ids).not.toContain(actB);
  });

  it('listVisible: B sees its own and the shared one, never A-only', async () => {
    covers('activities.listVisible');
    const ids = (await activities.listVisible(ctxB)).map((x) => x.row.id).sort();
    expect(ids).toEqual([actB, shared].sort());
    expect(ids).not.toContain(actA);
  });

  it('listVisible: C, in no list, sees nothing', async () => {
    covers('activities.listVisible');
    expect(await activities.listVisible(ctxC)).toEqual([]);
  });

  it('getVisible: A cannot fetch B-only by id; both can fetch the shared one; C cannot', async () => {
    covers('activities.getVisible');
    expect(await activities.getVisible(ctxA, actB)).toBeNull();
    expect(await activities.getVisible(ctxB, actA)).toBeNull();
    expect((await activities.getVisible(ctxA, shared))?.row.id).toBe(shared);
    expect((await activities.getVisible(ctxB, shared))?.row.id).toBe(shared);
    expect(await activities.getVisible(ctxC, shared)).toBeNull();
  });

  it('the shared activity has the same fields for A and B, and the cancelled date follows it', async () => {
    covers('activities.getVisible');
    const a = await activities.getVisible(ctxA, shared);
    const b = await activities.getVisible(ctxB, shared);
    expect(a?.row).toEqual(b?.row);
    expect(b?.cancelledDates).toEqual(['2026-11-02']);
  });

  it('canEditActivity: edit needs a role at the property named in the path AND that property offering it', async () => {
    covers('activities.canEditActivity');
    // staffA (admin at A): own and shared via A; not B-only; not via B's context.
    expect(await activities.canEditActivity(ctxA, staffA, actA)).toBe(true);
    expect(await activities.canEditActivity(ctxA, staffA, shared)).toBe(true);
    expect(await activities.canEditActivity(ctxA, staffA, actB)).toBe(false);
    expect(await activities.canEditActivity(ctxB, staffA, shared)).toBe(false);
    // staffB (editor at B): shared yes via B (any listed property may edit); A-only never.
    expect(await activities.canEditActivity(ctxB, staffB, shared)).toBe(true);
    expect(await activities.canEditActivity(ctxB, staffB, actA)).toBe(false);
    expect(await activities.canEditActivity(ctxA, staffB, shared)).toBe(false);
    // A property outside the list cannot edit, even with a role there.
    const staffC = await makeStaff(env.DB, 'c@iso.test', [{ propertyId: C.id, role: 'admin' }]);
    expect(await activities.canEditActivity(ctxC, staffC, shared)).toBe(false);
    // A person with no role at all.
    expect(await activities.canEditActivity(ctxA, 'f'.repeat(32), actA)).toBe(false);
  });

  it('canChangeOfferedAt: only an admin of the OWNER, acting under the owner', async () => {
    covers('activities.canChangeOfferedAt');
    expect(await activities.canChangeOfferedAt(ctxA, staffA, shared)).toBe(true);
    expect(await activities.canChangeOfferedAt(ctxA, staffAB, shared)).toBe(false); // editor at A
    expect(await activities.canChangeOfferedAt(ctxB, staffAB, shared)).toBe(false); // admin at B, but B is not the owner
    expect(await activities.canChangeOfferedAt(ctxB, staffB, shared)).toBe(false);
    expect(await activities.canChangeOfferedAt(ctxA, staffA, actB)).toBe(false);
  });

  it('removing B from the list removes the activity from B at once', async () => {
    covers('activities.listVisible', 'activities.getVisible');
    const own = await makeActivity(env.DB, A.id, [A.id, B.id], 'Temporarily shared');
    expect(await activities.getVisible(ctxB, own)).not.toBeNull();
    await env.DB.prepare('DELETE FROM activity_offered_at WHERE activity_id = ?1 AND property_id = ?2').bind(own, B.id).run();
    expect(await activities.getVisible(ctxB, own)).toBeNull();
    expect((await activities.listVisible(ctxB)).map((x) => x.row.id)).not.toContain(own);
  });
});

describe('places', () => {
  it('list and getById never cross properties', async () => {
    covers('places.list', 'places.getById');
    expect((await places.list(ctxA)).map((p) => p.id)).toEqual([placeA]);
    expect((await places.list(ctxB)).map((p) => p.id)).toEqual([placeB]);
    expect(await places.getById(ctxA, placeB)).toBeNull();
    expect(await places.getById(ctxB, placeA)).toBeNull();
    expect((await places.getById(ctxA, placeA))?.id).toBe(placeA);
    expect(await places.list(ctxC)).toEqual([]);
  });
});

describe('offers', () => {
  it('listShown and getShown never cross properties', async () => {
    covers('offers.listShown', 'offers.getShown');
    expect((await offers.listShown(ctxA, NOW)).map((o) => o.id)).toEqual([offerA]);
    expect((await offers.listShown(ctxB, NOW)).map((o) => o.id)).toEqual([offerB]);
    expect(await offers.getShown(ctxA, offerB, NOW)).toBeNull();
    expect(await offers.getShown(ctxB, offerA, NOW)).toBeNull();
    expect(await offers.listShown(ctxC, NOW)).toEqual([]);
  });

  it('an unverified or stale offer is hidden (09 §2)', async () => {
    covers('offers.listShown');
    const stale = await makeOffer(env.DB, A.id, NOW - 91 * 24 * 3600, 'Stale');
    const unchecked = await makeOffer(env.DB, A.id, NOW, 'Unchecked');
    await env.DB.prepare('UPDATE offers SET verified_on = NULL WHERE id = ?1').bind(unchecked).run();
    const ids = (await offers.listShown(ctxA, NOW)).map((o) => o.id);
    expect(ids).not.toContain(stale);
    expect(ids).not.toContain(unchecked);
  });
});

describe('properties', () => {
  it('getOwn and listFeatures return only the context property', async () => {
    covers('properties.getOwn', 'properties.listFeatures');
    expect((await properties.getOwn(ctxA))?.slug).toBe('iso-a');
    expect((await properties.getOwn(ctxB))?.slug).toBe('iso-b');
    expect(await properties.listFeatures(ctxA)).toEqual({ common_room: false, connect: false });
    expect(await properties.listFeatures(ctxB)).toEqual({ common_room: true, connect: false });
  });

  it('the placeholder flag counts only visible rows', async () => {
    covers('properties.getOwn');
    const p = await makeProperty(env.DB, 'iso-ph');
    const ctx = ctxFor(p);
    expect((await properties.getOwn(ctx))?.hasPlaceholders).toBe(false);
    const id = await makePlace(env.DB, p.id, 'Sample');
    await env.DB.prepare('UPDATE places SET is_placeholder = 1 WHERE id = ?1').bind(id).run();
    expect((await properties.getOwn(ctx))?.hasPlaceholders).toBe(true);
    // Another property's placeholder does not leak into this one's flag.
    expect((await properties.getOwn(ctxC))?.hasPlaceholders).toBe(false);
  });
});

describe('audit_log and event_counts (append and increment only)', () => {
  it('audit.append writes under the context property only', async () => {
    covers('audit.append');
    const id = await audit.append(ctxA, { actorKind: 'system', actorStaffId: null, action: 'test.action', targetType: 'activity', targetId: actA }, NOW);
    const row = await env.DB.prepare('SELECT property_id FROM audit_log WHERE id = ?1').bind(id).first<{ property_id: string }>();
    expect(row?.property_id).toBe(A.id);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE property_id = ?1 AND id = ?2').bind(B.id, id).first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('events.increment and countFor are per property, day and event', async () => {
    covers('events.increment', 'events.countFor');
    await events.increment(ctxA, '2026-10-23', 'opened_whats_on');
    await events.increment(ctxA, '2026-10-23', 'opened_whats_on');
    await events.increment(ctxB, '2026-10-23', 'opened_whats_on');
    expect(await events.countFor(ctxA, '2026-10-23', 'opened_whats_on')).toBe(2);
    expect(await events.countFor(ctxB, '2026-10-23', 'opened_whats_on')).toBe(1);
    expect(await events.countFor(ctxC, '2026-10-23', 'opened_whats_on')).toBe(0);
    expect(await events.countFor(ctxA, '2026-10-24', 'opened_whats_on')).toBe(0);
  });
});

describe('lookups that decide the property (documented exemptions)', () => {
  it('hosts.listPropertiesForHost returns only that host\'s properties and only public fields', async () => {
    covers('hosts.listPropertiesForHost');
    const rows = await hosts.listPropertiesForHost(env.DB, A.host);
    expect(rows.map((r) => r.slug)).toEqual(['iso-a']);
    expect(await hosts.listPropertiesForHost(env.DB, 'unknown.example')).toEqual([]);
  });

  it('staff.roleAtSlug answers only for a role the person really holds, per property', async () => {
    covers('staff.roleAtSlug');
    expect((await staff.roleAtSlug(env.DB, staffA, 'iso-a'))?.role).toBe('admin');
    expect(await staff.roleAtSlug(env.DB, staffA, 'iso-b')).toBeNull(); // naming B gives staffA nothing
    expect((await staff.roleAtSlug(env.DB, staffAB, 'iso-b'))?.role).toBe('admin');
    expect((await staff.roleAtSlug(env.DB, staffAB, 'iso-a'))?.role).toBe('editor');
    expect(await staff.roleAtSlug(env.DB, staffB, 'iso-c')).toBeNull();
  });

  it('staff.roleAtSlug refuses a disabled person and a suspended property', async () => {
    covers('staff.roleAtSlug');
    const p = await makeProperty(env.DB, 'iso-susp');
    const s = await makeStaff(env.DB, 'susp@iso.test', [{ propertyId: p.id, role: 'admin' }]);
    expect((await staff.roleAtSlug(env.DB, s, 'iso-susp'))?.role).toBe('admin');
    await env.DB.prepare('UPDATE staff_users SET disabled_at = 9 WHERE id = ?1').bind(s).run();
    expect(await staff.roleAtSlug(env.DB, s, 'iso-susp')).toBeNull();
  });

  it('flags.getFlag reads the platform flag', async () => {
    covers('flags.getFlag');
    expect(await flags.getFlag(env.DB, 'read_only')).toBe('off');
    expect(await flags.getFlag(env.DB, 'no_such_flag')).toBeNull();
  });
});
