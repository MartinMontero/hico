import type { TenantContext } from '../tenant.ts';
import type { ActivityCategory } from '../../shared/types.ts';
import { newId } from '../ids.ts';

// An activity is owned by one property and shown by every property in activity_offered_at
// (D-23). Every statement here carries the context property as o.property_id.

export interface ActivityRow {
  id: string;
  title_en: string;
  title_fr: string;
  description_en: string;
  description_fr: string;
  change_note_en: string;
  change_note_fr: string;
  category: ActivityCategory;
  zone_en: string | null;
  zone_fr: string | null;
  host_label: string;
  timezone: string;
  weekday: number | null;
  start_local: string | null;
  end_local: string | null;
  starts_at: number | null;
  ends_at: number | null;
  capacity: number | null;
  status: 'active' | 'cancelled';
  verified_on: number | null;
  verified_by: string | null;
  is_placeholder: number;
}

export interface ActivityWithDates {
  row: ActivityRow;
  cancelledDates: string[];
}

const COLUMNS = `a.id, a.title_en, a.title_fr, a.description_en, a.description_fr, a.change_note_en, a.change_note_fr, a.category,
  z.label_en AS zone_en, z.label_fr AS zone_fr, a.host_label, a.timezone, a.weekday,
  a.start_local, a.end_local, a.starts_at, a.ends_at, a.capacity, a.status,
  a.verified_on, a.verified_by, a.is_placeholder`;

const FROM = `FROM activity_offered_at o
  JOIN activities a ON a.id = o.activity_id AND a.property_id = o.owner_property_id
  LEFT JOIN zones z ON z.id = a.zone_id AND z.property_id = a.property_id`;

async function datesFor(ctx: TenantContext): Promise<Map<string, string[]>> {
  const { results } = await ctx.db
    .prepare(
      `SELECT e.activity_id, e.on_date
       FROM activity_exceptions e
       JOIN activity_offered_at o ON o.activity_id = e.activity_id AND o.owner_property_id = e.property_id
       WHERE o.property_id = ?1 AND e.kind = 'cancelled'
       ORDER BY e.on_date`,
    )
    .bind(ctx.propertyId)
    .all<{ activity_id: string; on_date: string }>();
  const map = new Map<string, string[]>();
  for (const r of results) map.set(r.activity_id, [...(map.get(r.activity_id) ?? []), r.on_date]);
  return map;
}

export async function listVisible(ctx: TenantContext): Promise<ActivityWithDates[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT ${COLUMNS} ${FROM}
       WHERE o.property_id = ?1
       ORDER BY COALESCE(a.weekday, 7), COALESCE(a.start_local, ''), a.starts_at, a.title_en`,
    )
    .bind(ctx.propertyId)
    .all<ActivityRow>();
  const dates = await datesFor(ctx);
  return results.map((row) => ({ row, cancelledDates: dates.get(row.id) ?? [] }));
}

export async function getVisible(ctx: TenantContext, id: string): Promise<ActivityWithDates | null> {
  const row = await ctx.db
    .prepare(`SELECT ${COLUMNS} ${FROM} WHERE o.property_id = ?1 AND a.id = ?2`)
    .bind(ctx.propertyId, id)
    .first<ActivityRow>();
  if (!row) return null;
  const dates = await datesFor(ctx);
  return { row, cancelledDates: dates.get(row.id) ?? [] };
}

/**
 * Edit rule (D-23): staff with editor or admin at the property named in the path may edit
 * an activity that THIS property offers. The role is read from the database now.
 */
export async function canEditActivity(
  ctx: TenantContext,
  staffUserId: string,
  activityId: string,
): Promise<boolean> {
  const row = await ctx.db
    .prepare(
      `SELECT 1 AS ok
       FROM activity_offered_at o
       JOIN staff_memberships m ON m.property_id = o.property_id
       WHERE o.property_id = ?1 AND o.activity_id = ?2 AND m.staff_user_id = ?3
         AND m.role IN ('editor', 'admin')`,
    )
    .bind(ctx.propertyId, activityId, staffUserId)
    .first<{ ok: number }>();
  return row !== null;
}

/** Only an admin of the OWNER property may change the offered-at list or delete (D-23). */
export async function canChangeOfferedAt(
  ctx: TenantContext,
  staffUserId: string,
  activityId: string,
): Promise<boolean> {
  const row = await ctx.db
    .prepare(
      `SELECT 1 AS ok
       FROM activities a
       JOIN staff_memberships m ON m.property_id = a.property_id
       WHERE a.property_id = ?1 AND a.id = ?2 AND m.staff_user_id = ?3 AND m.role = 'admin'`,
    )
    .bind(ctx.propertyId, activityId, staffUserId)
    .first<{ ok: number }>();
  return row !== null;
}

// ---------------------------------------------------------------------------------------------
// Staff side (Phase 1b-2). Every statement carries the context property: as o.property_id for what this
// property may see, as property_id for what it owns. A write names the version it was based on.
// ---------------------------------------------------------------------------------------------

export interface Stamp {
  on: number;
  by: string;
}

export interface StaffActivityRow extends ActivityRow {
  zone_id: string | null;
  owner_id: string;
  version: number;
}

export interface ActivityWrite {
  titleEn: string;
  titleFr: string;
  descriptionEn: string;
  descriptionFr: string;
  changeNoteEn: string;
  changeNoteFr: string;
  category: ActivityCategory;
  zoneId: string | null;
  hostLabel: string;
  capacity: number | null;
  /** weekly: weekday and startLocal/endLocal set, startsAt/endsAt null. One-off: the reverse, startLocal/endLocal null. */
  weekday: number | null;
  startLocal: string | null;
  endLocal: string | null;
  startsAt: number | null;
  endsAt: number | null;
}

export interface StaffActivityFull {
  row: StaffActivityRow;
  cancelledDates: string[];
  offeredAt: { slug: string; nameEn: string; nameFr: string }[];
}

const STAFF_COLUMNS = `${COLUMNS}, a.zone_id, a.property_id AS owner_id, a.version`;

async function offeredAtFor(ctx: TenantContext): Promise<Map<string, { slug: string; nameEn: string; nameFr: string }[]>> {
  const { results } = await ctx.db
    .prepare(
      `SELECT o2.activity_id, p.slug, p.name_en, p.name_fr
       FROM activity_offered_at o
       JOIN activity_offered_at o2 ON o2.activity_id = o.activity_id
       JOIN properties p ON p.id = o2.property_id
       WHERE o.property_id = ?1 AND p.suspended_at IS NULL
       ORDER BY p.slug`,
    )
    .bind(ctx.propertyId)
    .all<{ activity_id: string; slug: string; name_en: string; name_fr: string }>();
  const map = new Map<string, { slug: string; nameEn: string; nameFr: string }[]>();
  for (const r of results) map.set(r.activity_id, [...(map.get(r.activity_id) ?? []), { slug: r.slug, nameEn: r.name_en, nameFr: r.name_fr }]);
  return map;
}

export async function listForStaff(ctx: TenantContext): Promise<StaffActivityFull[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT ${STAFF_COLUMNS} ${FROM}
       WHERE o.property_id = ?1
       ORDER BY COALESCE(a.weekday, 7), COALESCE(a.start_local, ''), a.starts_at, a.title_en`,
    )
    .bind(ctx.propertyId)
    .all<StaffActivityRow>();
  const [dates, offered] = await Promise.all([datesFor(ctx), offeredAtFor(ctx)]);
  return results.map((row) => ({ row, cancelledDates: dates.get(row.id) ?? [], offeredAt: offered.get(row.id) ?? [] }));
}

export async function getForStaff(ctx: TenantContext, id: string): Promise<StaffActivityFull | null> {
  const row = await ctx.db
    .prepare(`SELECT ${STAFF_COLUMNS} ${FROM} WHERE o.property_id = ?1 AND a.id = ?2`)
    .bind(ctx.propertyId, id)
    .first<StaffActivityRow>();
  if (!row) return null;
  const [dates, offered] = await Promise.all([datesFor(ctx), offeredAtFor(ctx)]);
  return { row, cancelledDates: dates.get(row.id) ?? [], offeredAt: offered.get(row.id) ?? [] };
}

/** Creates an activity owned by, and offered at, the context property only. */
export async function insert(ctx: TenantContext, f: ActivityWrite, stamp: Stamp, timezone: string, now: number): Promise<string> {
  const id = newId();
  await ctx.db.batch([
    ctx.db
      .prepare(
        `INSERT INTO activities (id, property_id, title_en, title_fr, description_en, description_fr, category, zone_id, host_label, timezone,
           weekday, start_local, end_local, starts_at, ends_at, capacity, status, verified_on, verified_by, is_placeholder, created_at, updated_at,
           change_note_en, change_note_fr)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'active', ?17, ?18, 0, ?19, ?19, ?20, ?21)`,
      )
      .bind(id, ctx.propertyId, f.titleEn, f.titleFr, f.descriptionEn, f.descriptionFr, f.category, f.zoneId, f.hostLabel, timezone, f.weekday, f.startLocal, f.endLocal, f.startsAt, f.endsAt, f.capacity, stamp.on, stamp.by, now, f.changeNoteEn, f.changeNoteFr),
    ctx.db.prepare('INSERT INTO activity_offered_at (activity_id, owner_property_id, property_id) VALUES (?1, ?2, ?2)').bind(id, ctx.propertyId),
  ]);
  return id;
}

const VISIBLE = `EXISTS (SELECT 1 FROM activity_offered_at o
  WHERE o.activity_id = activities.id AND o.owner_property_id = activities.property_id AND o.property_id = ?3)`;

async function outcome(ctx: TenantContext, id: string, changes: number): Promise<'ok' | 'conflict' | 'missing'> {
  if (changes > 0) return 'ok';
  return (await getForStaff(ctx, id)) ? 'conflict' : 'missing';
}

/**
 * Content edit (D-23): any property that offers the activity may edit it; the zone belongs to the owner, so only the
 * owner can change it. `version` is the version the editor saw: a mismatch changes nothing and says 'conflict'.
 */
export async function update(ctx: TenantContext, id: string, version: number, f: ActivityWrite, stamp: Stamp, now: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare(
      `UPDATE activities SET title_en = ?4, title_fr = ?5, description_en = ?6, description_fr = ?7, category = ?8,
         zone_id = CASE WHEN property_id = ?3 THEN ?9 ELSE zone_id END, host_label = ?10, capacity = ?11,
         weekday = ?12, start_local = ?13, end_local = ?14, starts_at = ?15, ends_at = ?16,
         verified_on = ?17, verified_by = ?18, is_placeholder = 0, version = version + 1, updated_at = ?19,
         change_note_en = ?20, change_note_fr = ?21
       WHERE id = ?1 AND version = ?2 AND ${VISIBLE}`,
    )
    .bind(id, version, ctx.propertyId, f.titleEn, f.titleFr, f.descriptionEn, f.descriptionFr, f.category, f.zoneId, f.hostLabel, f.capacity, f.weekday, f.startLocal, f.endLocal, f.startsAt, f.endsAt, stamp.on, stamp.by, now, f.changeNoteEn, f.changeNoteFr)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

/** "Re-verify": today's stamp without touching the text. */
export async function reverify(ctx: TenantContext, id: string, version: number, stamp: Stamp, now: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare(`UPDATE activities SET verified_on = ?4, verified_by = ?5, is_placeholder = 0, version = version + 1, updated_at = ?6 WHERE id = ?1 AND version = ?2 AND ${VISIBLE}`)
    .bind(id, version, ctx.propertyId, stamp.on, stamp.by, now)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

/** Cancel or reactivate the whole series. */
export async function setStatus(ctx: TenantContext, id: string, version: number, status: 'active' | 'cancelled', now: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare(`UPDATE activities SET status = ?4, version = version + 1, updated_at = ?5 WHERE id = ?1 AND version = ?2 AND ${VISIBLE}`)
    .bind(id, version, ctx.propertyId, status, now)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

/** Cancel one date of a series, for every property that offers it. */
export async function cancelDate(ctx: TenantContext, id: string, date: string): Promise<'ok' | 'exists' | 'missing'> {
  try {
    const r = await ctx.db
      .prepare(
        `INSERT INTO activity_exceptions (id, activity_id, property_id, on_date, kind)
         SELECT ?1, a.id, a.property_id, ?3, 'cancelled' FROM activities a
         JOIN activity_offered_at o ON o.activity_id = a.id AND o.owner_property_id = a.property_id
         WHERE a.id = ?2 AND o.property_id = ?4`,
      )
      .bind(newId(), id, date, ctx.propertyId)
      .run();
    return r.meta.changes > 0 ? 'ok' : 'missing';
  } catch {
    return 'exists'; // UNIQUE (activity_id, on_date)
  }
}

export async function restoreDate(ctx: TenantContext, id: string, date: string): Promise<boolean> {
  const r = await ctx.db
    .prepare(
      `DELETE FROM activity_exceptions WHERE activity_id = ?1 AND on_date = ?2
         AND EXISTS (SELECT 1 FROM activity_offered_at o WHERE o.activity_id = ?1 AND o.owner_property_id = activity_exceptions.property_id AND o.property_id = ?3)`,
    )
    .bind(id, date, ctx.propertyId)
    .run();
  return r.meta.changes > 0;
}

/** Delete: only the OWNER's property can (the route also requires the owner's admin). Children go first, each guarded by the version. */
export async function remove(ctx: TenantContext, id: string, version: number): Promise<'ok' | 'conflict' | 'missing'> {
  const owned = `EXISTS (SELECT 1 FROM activities WHERE id = ?1 AND property_id = ?2 AND version = ?3)`;
  const [, , last] = await ctx.db.batch([
    ctx.db.prepare(`DELETE FROM activity_exceptions WHERE activity_id = ?1 AND property_id = ?2 AND ${owned}`).bind(id, ctx.propertyId, version),
    ctx.db.prepare(`DELETE FROM activity_offered_at WHERE activity_id = ?1 AND owner_property_id = ?2 AND ${owned}`).bind(id, ctx.propertyId, version),
    ctx.db.prepare('DELETE FROM activities WHERE id = ?1 AND property_id = ?2 AND version = ?3').bind(id, ctx.propertyId, version),
  ]);
  if ((last?.meta.changes ?? 0) > 0) return 'ok';
  const there = await ctx.db.prepare('SELECT 1 AS ok FROM activities WHERE id = ?1 AND property_id = ?2').bind(id, ctx.propertyId).first();
  return there ? 'conflict' : 'missing';
}

/** Owner only. The target property must already have been checked by the caller (the actor holds a role there). */
export async function addOfferedAt(ctx: TenantContext, id: string, targetPropertyId: string): Promise<boolean> {
  const r = await ctx.db
    .prepare(
      `INSERT OR IGNORE INTO activity_offered_at (activity_id, owner_property_id, property_id)
       SELECT a.id, a.property_id, ?3 FROM activities a WHERE a.id = ?1 AND a.property_id = ?2`,
    )
    .bind(id, ctx.propertyId, targetPropertyId)
    .run();
  return r.meta.changes > 0;
}

/** Owner only, and only a property already in the list (found by slug inside the list, so no other tenant is looked up). The owner itself stays. */
export async function removeOfferedAt(ctx: TenantContext, id: string, slug: string): Promise<boolean> {
  const r = await ctx.db
    .prepare(
      `DELETE FROM activity_offered_at
       WHERE activity_id = ?1 AND owner_property_id = ?2 AND property_id <> ?2
         AND property_id = (SELECT p.id FROM properties p JOIN activity_offered_at x ON x.property_id = p.id WHERE x.activity_id = ?1 AND p.slug = ?3)`,
    )
    .bind(id, ctx.propertyId, slug)
    .run();
  return r.meta.changes > 0;
}