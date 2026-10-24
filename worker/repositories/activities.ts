import type { TenantContext } from '../tenant.ts';
import type { ActivityCategory } from '../../shared/types.ts';

// An activity is owned by one property and shown by every property in activity_offered_at
// (D-23). Every statement here carries the context property as o.property_id.

export interface ActivityRow {
  id: string;
  title_en: string;
  title_fr: string;
  description_en: string;
  description_fr: string;
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

const COLUMNS = `a.id, a.title_en, a.title_fr, a.description_en, a.description_fr, a.category,
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
