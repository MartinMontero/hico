import { Hono, type Context } from 'hono';
import * as v from 'valibot';
import { dayBounds, localToEpoch } from '../../shared/time.ts';
import {
  activityCreateSchema,
  activityUpdateSchema,
  codeCreateSchema,
  dateBodySchema,
  featureBodySchema,
  featureNameSchema,
  offerCreateSchema,
  offerUpdateSchema,
  placeCreateSchema,
  placeUpdateSchema,
  slugBodySchema,
  statusSchema,
  versionSchema,
  zoneCreateSchema,
  zoneUpdateSchema,
  type ActivityInput,
  type OfferInput,
} from '../../shared/staff-content-schemas.ts';
import { idSchema } from '../../shared/staff-schemas.ts';
import { projectStaffActivity, projectStaffCode, projectStaffOffer, projectStaffPlace, projectStaffZone } from '../projections-staff.ts';
import type { AppEnv } from '../middleware/tenant.ts';
import { activities, audit, codes, features, offers, people, places, properties, staff, zones } from '../repositories/index.ts';
import type { ActivityWrite, Stamp } from '../repositories/activities.ts';
import { requireAdmin } from './staff-people.ts';

type C = Context<AppEnv>;

/** The signed-in person's stamp: today, and their display name (never taken from the request). */
async function stampFor(c: C, now: number): Promise<Stamp> {
  const { staffUserId, tenant } = c.get('staff');
  const person = await people.findUserById(tenant.db, staffUserId);
  return { on: now, by: (person?.displayName || 'Staff').slice(0, 80) };
}

async function body<T>(c: C, schema: v.GenericSchema<unknown, T>): Promise<T | null> {
  const parsed = v.safeParse(schema, await c.req.json().catch(() => null));
  return parsed.success ? parsed.output : null;
}

const idOf = (c: C): string | null => {
  const r = v.safeParse(idSchema, c.req.param('id'));
  return r.success ? r.output : null;
};

/** Weekly or one-off, converted to what the table stores. One-off times are the wall clock of the activity's own zone. */
function toWrite(input: ActivityInput, timezone: string): ActivityWrite | 'end_before_start' {
  const base = {
    titleEn: input.titleEn, titleFr: input.titleFr, descriptionEn: input.descriptionEn, descriptionFr: input.descriptionFr,
    changeNoteEn: input.changeNoteEn, changeNoteFr: input.changeNoteFr,
    category: input.category, zoneId: input.zoneId, hostLabel: input.hostLabel, capacity: input.capacity,
  };
  const s = input.schedule;
  if (s.kind === 'weekly') {
    if (s.endLocal !== null && s.endLocal <= s.startLocal) return 'end_before_start';
    return { ...base, weekday: s.weekday, startLocal: s.startLocal, endLocal: s.endLocal, startsAt: null, endsAt: null };
  }
  const startsAt = localToEpoch(s.date, s.startLocal, timezone);
  const endsAt = s.endLocal !== null ? localToEpoch(s.date, s.endLocal, timezone) : null;
  if (endsAt !== null && endsAt <= startsAt) return 'end_before_start';
  return { ...base, weekday: null, startLocal: null, endLocal: null, startsAt, endsAt };
}

/** Staff content routes for one property: board, places, offers, zones, QR labels, switches. Roles per `04` §4.8 and the plan §3. */
export function createStaffContentRoutes(now: () => number): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  const note = (c: C, action: string, targetType: string, targetId: string | null) => {
    const { tenant, staffUserId } = c.get('staff');
    return audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action, targetType, targetId }, now());
  };
  const activityView = async (c: C, id: string) => {
    const s = c.get('staff');
    const full = await activities.getForStaff(s.tenant, id);
    return full ? projectStaffActivity(full, { propertyId: s.tenant.propertyId, role: s.role }, now()) : null;
  };

  // ---------------------------------------------------------------- zones (admin writes)
  r.get('/zones', async (c) => c.json((await zones.list(c.get('tenant'))).map(projectStaffZone)));

  r.post('/zones', requireAdmin, async (c) => {
    const input = await body(c, zoneCreateSchema);
    if (!input) return c.json({ error: 'bad_request' }, 400);
    const id = await zones.insert(c.get('tenant'), input);
    await note(c, 'staff.zone.created', 'zone', id);
    const z = await zones.getById(c.get('tenant'), id);
    return c.json(z ? projectStaffZone(z) : null);
  });

  r.post('/zones/:id', requireAdmin, async (c) => {
    const id = idOf(c);
    const input = await body(c, zoneUpdateSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await zones.update(c.get('tenant'), id, input.version, input);
    const current = await zones.getById(c.get('tenant'), id);
    if (result === 'missing' || !current) return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: projectStaffZone(current) }, 409);
    await note(c, 'staff.zone.updated', 'zone', id);
    return c.json(projectStaffZone(current));
  });

  r.post('/zones/:id/delete', requireAdmin, async (c) => {
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await zones.remove(c.get('tenant'), id, input.version);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'in_use') return c.json({ error: 'in_use' }, 409);
    if (result === 'conflict') return c.json({ error: 'conflict' }, 409);
    await note(c, 'staff.zone.deleted', 'zone', id);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- the board
  r.get('/activities', async (c) => {
    const s = c.get('staff');
    const rows = await activities.listForStaff(s.tenant);
    return c.json(rows.map((a) => projectStaffActivity(a, { propertyId: s.tenant.propertyId, role: s.role }, now())));
  });

  r.post('/activities', async (c) => {
    const s = c.get('staff');
    const input = await body(c, activityCreateSchema);
    if (!input) return c.json({ error: 'bad_request' }, 400);
    const write = toWrite(input, s.tenant.timezone);
    if (write === 'end_before_start') return c.json({ error: 'end_before_start' }, 400);
    try {
      const id = await activities.insert(s.tenant, write, await stampFor(c, now()), s.tenant.timezone, now());
      await note(c, 'staff.activity.created', 'activity', id);
      return c.json(await activityView(c, id));
    } catch {
      return c.json({ error: 'bad_zone' }, 400); // a zone of another property cannot be named (composite key)
    }
  });

  r.post('/activities/:id', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, activityUpdateSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const existing = await activities.getForStaff(s.tenant, id);
    if (!existing || !(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    // The zone is where the OWNER's staff meet guests: only the owner changes it.
    if (existing.row.owner_id !== s.tenant.propertyId && input.zoneId !== existing.row.zone_id) return c.json({ error: 'owner_only' }, 403);
    const write = toWrite(input, existing.row.timezone);
    if (write === 'end_before_start') return c.json({ error: 'end_before_start' }, 400);
    let result;
    try {
      result = await activities.update(s.tenant, id, input.version, write, await stampFor(c, now()), now());
    } catch {
      return c.json({ error: 'bad_zone' }, 400);
    }
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: await activityView(c, id) }, 409);
    await note(c, 'staff.activity.updated', 'activity', id);
    return c.json(await activityView(c, id));
  });

  r.post('/activities/:id/reverify', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    const result = await activities.reverify(s.tenant, id, input.version, await stampFor(c, now()), now());
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: await activityView(c, id) }, 409);
    await note(c, 'staff.activity.reverified', 'activity', id);
    return c.json(await activityView(c, id));
  });

  r.post('/activities/:id/status', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, statusSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    const result = await activities.setStatus(s.tenant, id, input.version, input.status, now());
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: await activityView(c, id) }, 409);
    await note(c, 'staff.activity.status_changed', 'activity', id);
    return c.json(await activityView(c, id));
  });

  r.post('/activities/:id/duplicate', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    if (!id) return c.json({ error: 'bad_request' }, 400);
    const source = await activities.getForStaff(s.tenant, id);
    if (!source || !(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    const row = source.row;
    const isOwner = row.owner_id === s.tenant.propertyId;
    const copy = (text: string, suffix: string) => (text === '' ? '' : `${text} (${suffix})`.slice(0, 120));
    const write: ActivityWrite = {
      titleEn: copy(row.title_en, 'copy'), titleFr: copy(row.title_fr, 'copie'), descriptionEn: row.description_en, descriptionFr: row.description_fr,
      changeNoteEn: '', changeNoteFr: '', // a copy starts with no change note
      category: row.category, zoneId: isOwner ? row.zone_id : null, hostLabel: row.host_label, capacity: row.capacity,
      weekday: row.weekday, startLocal: row.start_local, endLocal: row.end_local, startsAt: row.starts_at, endsAt: row.ends_at,
    };
    // The copy belongs to THIS property alone, in the original's own time zone, and needs its own check.
    const newId = await activities.insert(s.tenant, write, await stampFor(c, now()), row.timezone, now());
    await note(c, 'staff.activity.duplicated', 'activity', newId);
    return c.json(await activityView(c, newId));
  });

  r.post('/activities/:id/cancel-date', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, dateBodySchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    const result = await activities.cancelDate(s.tenant, id, input.date);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'exists') return c.json({ error: 'already_cancelled' }, 409);
    await note(c, 'staff.activity.date_cancelled', 'activity', id);
    return c.json(await activityView(c, id));
  });

  r.post('/activities/:id/restore-date', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, dateBodySchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.canEditActivity(s.tenant, s.staffUserId, id))) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.restoreDate(s.tenant, id, input.date))) return c.json({ error: 'not_found' }, 404);
    await note(c, 'staff.activity.date_restored', 'activity', id);
    return c.json(await activityView(c, id));
  });

  // Owner-admin only (D-23): delete, and the list of properties that offer it.
  r.post('/activities/:id/delete', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.getForStaff(s.tenant, id))) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.canChangeOfferedAt(s.tenant, s.staffUserId, id))) return c.json({ error: 'owner_admin_only' }, 403);
    const result = await activities.remove(s.tenant, id, input.version);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: await activityView(c, id) }, 409);
    await note(c, 'staff.activity.deleted', 'activity', id);
    return c.json({ ok: true });
  });

  /** Only properties where THIS person also holds a role are offered: no other tenant's name is ever listed. */
  r.get('/activities/:id/offered-at/options', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    if (!id) return c.json({ error: 'bad_request' }, 400);
    const full = await activities.getForStaff(s.tenant, id);
    if (!full) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.canChangeOfferedAt(s.tenant, s.staffUserId, id))) return c.json({ error: 'owner_admin_only' }, 403);
    const listed = new Set(full.offeredAt.map((o) => o.slug));
    const mine = await people.membershipsOf(s.tenant.db, s.staffUserId);
    return c.json(mine.filter((m) => !listed.has(m.slug)).map((m) => ({ slug: m.slug, name: { en: m.nameEn, fr: m.nameFr } })));
  });

  r.post('/activities/:id/offered-at/add', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, slugBodySchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.getForStaff(s.tenant, id))) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.canChangeOfferedAt(s.tenant, s.staffUserId, id))) return c.json({ error: 'owner_admin_only' }, 403);
    // The actor must hold a role at the target property: otherwise one tenant could probe another's slugs.
    const access = await staff.roleAtSlug(s.tenant.db, s.staffUserId, input.slug);
    if (!access) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.addOfferedAt(s.tenant, id, access.propertyId))) return c.json({ error: 'already_listed' }, 409);
    await note(c, 'staff.activity.offered_at_added', 'activity', id);
    return c.json(await activityView(c, id));
  });

  r.post('/activities/:id/offered-at/remove', async (c) => {
    const s = c.get('staff');
    const id = idOf(c);
    const input = await body(c, slugBodySchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (!(await activities.getForStaff(s.tenant, id))) return c.json({ error: 'not_found' }, 404);
    if (!(await activities.canChangeOfferedAt(s.tenant, s.staffUserId, id))) return c.json({ error: 'owner_admin_only' }, 403);
    if (!(await activities.removeOfferedAt(s.tenant, id, input.slug))) return c.json({ error: 'not_listed' }, 409); // also the owner itself
    await note(c, 'staff.activity.offered_at_removed', 'activity', id);
    return c.json(await activityView(c, id));
  });

  // ---------------------------------------------------------------- places
  r.get('/places', async (c) => c.json((await places.listForStaff(c.get('tenant'))).map((p) => projectStaffPlace(p, now()))));

  r.post('/places', async (c) => {
    const input = await body(c, placeCreateSchema);
    if (!input) return c.json({ error: 'bad_request' }, 400);
    const id = await places.insert(c.get('tenant'), input, await stampFor(c, now()), now());
    await note(c, 'staff.place.created', 'place', id);
    const row = await places.getForStaff(c.get('tenant'), id);
    return c.json(row ? projectStaffPlace(row, now()) : null);
  });

  r.post('/places/:id', async (c) => {
    const id = idOf(c);
    const input = await body(c, placeUpdateSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await places.update(c.get('tenant'), id, input.version, input, await stampFor(c, now()), now());
    const row = await places.getForStaff(c.get('tenant'), id);
    if (result === 'missing' || !row) return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: projectStaffPlace(row, now()) }, 409);
    await note(c, 'staff.place.updated', 'place', id);
    return c.json(projectStaffPlace(row, now()));
  });

  r.post('/places/:id/reverify', async (c) => {
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await places.reverify(c.get('tenant'), id, input.version, await stampFor(c, now()), now());
    const row = await places.getForStaff(c.get('tenant'), id);
    if (result === 'missing' || !row) return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: projectStaffPlace(row, now()) }, 409);
    await note(c, 'staff.place.reverified', 'place', id);
    return c.json(projectStaffPlace(row, now()));
  });

  r.post('/places/:id/delete', requireAdmin, async (c) => {
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await places.remove(c.get('tenant'), id, input.version);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict' }, 409);
    await note(c, 'staff.place.deleted', 'place', id);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- offers
  const offerWrite = (input: OfferInput, tz: string) => ({
    partnerName: input.partnerName, termsEn: input.termsEn, termsFr: input.termsFr,
    validFrom: input.validFrom ? dayBounds(input.validFrom, tz).start : null,
    validTo: input.validTo ? dayBounds(input.validTo, tz).end : null,
    requiresMembership: input.requiresMembership, howWeKnowEn: input.howWeKnowEn, howWeKnowFr: input.howWeKnowFr,
  });
  const offerOrder = (a: OfferInput) => a.validFrom !== null && a.validTo !== null && a.validTo < a.validFrom;

  r.get('/offers', async (c) => {
    const t = c.get('tenant');
    return c.json((await offers.listForStaff(t)).map((o) => projectStaffOffer(o, t.timezone, now())));
  });

  r.post('/offers', async (c) => {
    const t = c.get('tenant');
    const input = await body(c, offerCreateSchema);
    if (!input) return c.json({ error: 'bad_request' }, 400);
    if (offerOrder(input)) return c.json({ error: 'ends_before_start' }, 400);
    const id = await offers.insert(t, offerWrite(input, t.timezone), await stampFor(c, now()), now());
    await note(c, 'staff.offer.created', 'offer', id);
    const row = await offers.getForStaff(t, id);
    return c.json(row ? projectStaffOffer(row, t.timezone, now()) : null);
  });

  r.post('/offers/:id', async (c) => {
    const t = c.get('tenant');
    const id = idOf(c);
    const input = await body(c, offerUpdateSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    if (offerOrder(input)) return c.json({ error: 'ends_before_start' }, 400);
    const result = await offers.update(t, id, input.version, offerWrite(input, t.timezone), await stampFor(c, now()));
    const row = await offers.getForStaff(t, id);
    if (result === 'missing' || !row) return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: projectStaffOffer(row, t.timezone, now()) }, 409);
    await note(c, 'staff.offer.updated', 'offer', id);
    return c.json(projectStaffOffer(row, t.timezone, now()));
  });

  r.post('/offers/:id/reverify', async (c) => {
    const t = c.get('tenant');
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await offers.reverify(t, id, input.version, await stampFor(c, now()));
    const row = await offers.getForStaff(t, id);
    if (result === 'missing' || !row) return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict', current: projectStaffOffer(row, t.timezone, now()) }, 409);
    await note(c, 'staff.offer.reverified', 'offer', id);
    return c.json(projectStaffOffer(row, t.timezone, now()));
  });

  r.post('/offers/:id/delete', requireAdmin, async (c) => {
    const id = idOf(c);
    const input = await body(c, versionSchema);
    if (!id || !input) return c.json({ error: 'bad_request' }, 400);
    const result = await offers.remove(c.get('tenant'), id, input.version);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'conflict') return c.json({ error: 'conflict' }, 409);
    await note(c, 'staff.offer.deleted', 'offer', id);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- QR labels (Stage 0: labelled links)
  r.get('/codes', async (c) => c.json((await codes.list(c.get('tenant'))).map(projectStaffCode)));

  r.post('/codes', requireAdmin, async (c) => {
    const input = await body(c, codeCreateSchema);
    if (!input) return c.json({ error: 'bad_request' }, 400);
    const result = await codes.insert(c.get('tenant'), input.label, now());
    if (result === 'exists') return c.json({ error: 'label_exists' }, 409);
    await note(c, 'staff.code.created', 'code', result.id);
    return c.json((await codes.list(c.get('tenant'))).map(projectStaffCode));
  });

  r.post('/codes/:id/retire', requireAdmin, async (c) => {
    const id = idOf(c);
    if (!id) return c.json({ error: 'bad_request' }, 400);
    if (!(await codes.retire(c.get('tenant'), id, now()))) return c.json({ error: 'not_found' }, 404);
    await note(c, 'staff.code.retired', 'code', id);
    return c.json((await codes.list(c.get('tenant'))).map(projectStaffCode));
  });

  // ---------------------------------------------------------------- feature switches (default off, admin)
  r.get('/features', async (c) => c.json(await properties.listFeatures(c.get('tenant'))));

  r.post('/features/:name', requireAdmin, async (c) => {
    const name = v.safeParse(featureNameSchema, c.req.param('name'));
    const input = await body(c, featureBodySchema);
    if (!name.success || !input) return c.json({ error: 'bad_request' }, 400);
    const s = c.get('staff');
    await features.set(s.tenant, name.output, input.enabled, s.staffUserId, now());
    await note(c, input.enabled ? 'staff.feature.enabled' : 'staff.feature.disabled', 'feature', null);
    return c.json(await properties.listFeatures(s.tenant));
  });

  return r;
}
