import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from '../support/app.ts';
import { makeProperty, makeStaff, makeZone, nameStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

interface StaffZone { label: { en: string } }
interface StaffPlace { name: string; verifiedOn: number | null; verifiedBy: string | null }
interface StaffActivity { title: { en: string }; verifiedOn: number | null; verifiedBy: string | null; zoneId: string | null }
interface AuditRow { action: string }

interface Report {
  mode: 'dry_run' | 'apply';
  valid: boolean;
  itemCount: number;
  issues: { index: number; code: string }[];
  confirmation?: string;
  imported?: number;
}

let A: PropertyFixture, B: PropertyFixture;
let adminA: string, editorA: string, adminB: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'import-a', { host: 'import-a.test' });
  B = await makeProperty(env.DB, 'import-b', { host: 'import-b.test' });
  const person = await makeStaff(env.DB, 'admin@import.test', [{ propertyId: A.id, role: 'admin' }]);
  await nameStaff(env.DB, person, 'Import Admin');
  adminA = await sessionCookieFor(env.DB, person);
  editorA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'editor@import.test', [{ propertyId: A.id, role: 'editor' }]));
  adminB = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin-b@import.test', [{ propertyId: B.id, role: 'admin' }]));
  await makeZone(env.DB, A.id, 'Lobby');
});

const zoneDoc = (labelEn = 'Deck', clientKey = 'zone-deck') => ({ format: 'hico-zones-v1', items: [{ clientKey, labelEn, labelFr: `${labelEn} FR`, ring: 'in_hostel' }] });
const placeDoc = () => ({ format: 'hico-places-v1', items: [{
  clientKey: 'place-cafe', category: 'food', name: 'Property Cafe', staffPick: true, noteEn: 'Note', noteFr: 'Note FR',
  walkTimeEn: '2 minutes', walkTimeFr: '2 minutes', hoursEn: 'Morning', hoursFr: 'Matin', phone: null, mapsAddress: '1 Real St',
  verified_on: 123, verified_by: 'Client Forgery',
}] });
const activityDoc = () => ({ format: 'hico-activities-v1', items: [{
  clientKey: 'activity-walk', titleEn: 'Morning Walk', titleFr: 'Marche', descriptionEn: 'Walk', descriptionFr: 'Marche',
  changeNoteEn: '', changeNoteFr: '', category: 'outdoor', zoneLabelEn: 'Lobby', hostLabel: 'Host', capacity: 12,
  schedule: { kind: 'weekly', weekday: 2, startLocal: '09:00', endLocal: '10:00' }, offeredAt: [A.slug],
}] });

async function send(p: PropertyFixture, cookie: string, mode: 'dry_run' | 'apply', document: unknown, confirmation?: string) {
  const res = await call(`/api/staff/p/${p.slug}/import`, { host: p.host, method: 'POST', headers: { Cookie: cookie }, body: { mode, document, confirmation } });
  return { status: res.status, body: await res.json() as Report & { error?: string } };
}
const get = async <T,>(path: string): Promise<T> => (await call(`/api/staff/p/${A.slug}${path}`, { host: A.host, headers: { Cookie: adminA } })).json() as T;

describe('bulk import dry run and confirmation', () => {
  it('a dry run validates and returns a confirmation without creating content', async () => {
    const result = await send(A, adminA, 'dry_run', zoneDoc());
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ valid: true, itemCount: 1 });
    expect(result.body.confirmation).toMatch(/^[a-f0-9]{64}$/);
    expect(await get<StaffZone[]>('/zones')).toEqual([expect.objectContaining({ label: expect.objectContaining({ en: 'Lobby' }) })]);
  });

  it('apply needs the exact fresh confirmation and then imports only once', async () => {
    expect((await send(A, adminA, 'apply', zoneDoc('Patio', 'zone-patio'))).status).toBe(400);
    const dry = await send(A, adminA, 'dry_run', zoneDoc('Patio', 'zone-patio'));
    expect((await send(A, adminA, 'apply', zoneDoc('Patio', 'zone-patio'), '0'.repeat(64))).status).toBe(409);
    expect((await get<StaffZone[]>('/zones')).some((z: StaffZone) => z.label.en === 'Patio')).toBe(false);
    const applied = await send(A, adminA, 'apply', zoneDoc('Patio', 'zone-patio'), dry.body.confirmation);
    expect(applied.status).toBe(200);
    expect(applied.body.imported).toBe(1);
    const again = await send(A, adminA, 'dry_run', zoneDoc('Patio', 'zone-patio'));
    expect(again.body.valid).toBe(false);
    expect(again.body.issues).toContainEqual(expect.objectContaining({ code: 'duplicate_content' }));
    expect((await get<StaffZone[]>('/zones')).filter((z: StaffZone) => z.label.en === 'Patio')).toHaveLength(1);
  });

  it('rejects repeated client keys and repeated content within one file', async () => {
    const doc = zoneDoc();
    const first = doc.items[0]!;
    doc.items.push({ ...first, clientKey: 'other-key' }, { ...first, labelEn: 'Unique but repeated key' });
    const result = await send(A, adminA, 'dry_run', doc);
    expect(result.body.valid).toBe(false);
    expect(result.body.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['duplicate_client_key', 'duplicate_content']));
  });
});

describe('imported verification and tenancy', () => {
  it('places record the importing person but stay unverified until staff re-check them', async () => {
    const dry = await send(A, adminA, 'dry_run', placeDoc());
    expect((await send(A, adminA, 'apply', placeDoc(), dry.body.confirmation)).status).toBe(200);
    const rows = await get<StaffPlace[]>('/places');
    expect(rows).toEqual([expect.objectContaining({ name: 'Property Cafe', verifiedOn: null, verifiedBy: 'Import Admin' })]);
    expect(JSON.stringify(rows)).not.toContain('Client Forgery');
  });

  it('activities use an own-property zone and cannot be shared to another property by import', async () => {
    const dry = await send(A, adminA, 'dry_run', activityDoc());
    expect(dry.body.valid).toBe(true);
    expect((await send(A, adminA, 'apply', activityDoc(), dry.body.confirmation)).status).toBe(200);
    const rows = await get<StaffActivity[]>('/activities');
    expect(rows).toEqual([expect.objectContaining({ title: expect.objectContaining({ en: 'Morning Walk' }), verifiedOn: null, verifiedBy: 'Import Admin', zoneId: expect.any(String) })]);
    const cross = activityDoc();
    cross.items[0]!.offeredAt = [B.slug];
    expect((await send(A, adminA, 'dry_run', cross)).body.issues).toContainEqual(expect.objectContaining({ code: 'off_property_share' }));
    const unknown = activityDoc();
    unknown.items[0]!.zoneLabelEn = 'B secret zone';
    expect((await send(A, adminA, 'dry_run', unknown)).body.issues).toContainEqual(expect.objectContaining({ code: 'unknown_zone' }));
  });

  it('another tenant admin and an editor cannot use the importer', async () => {
    expect((await send(A, editorA, 'dry_run', zoneDoc('Forbidden'))).status).toBe(403);
    expect((await send(A, adminB, 'dry_run', zoneDoc('Forbidden'))).status).toBe(404);
    expect((await get<StaffZone[]>('/zones')).some((z: StaffZone) => z.label.en === 'Forbidden')).toBe(false);
  });

  it('every imported row and the apply operation are audited for this property', async () => {
    const audit = await get<AuditRow[]>('/audit?action=staff.import.applied');
    expect(audit.length).toBeGreaterThanOrEqual(3);
    const zones = await get<AuditRow[]>('/audit?action=staff.import.zone_created');
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(audit)).not.toContain(B.id);
  });
});
