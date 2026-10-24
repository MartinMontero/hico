import type { StaffRole } from '../tenant.ts';

export interface StaffAccess {
  propertyId: string;
  slug: string;
  timezone: string;
  role: StaffRole;
}

/**
 * EXEMPT from "property_id in every statement": this is the authorisation lookup itself
 * (05 §4 rules 1 and 8). It names the property by the slug in the staff path and returns
 * something only if THAT staff member holds a role in THAT property, read from the
 * database on every request.
 */
export async function roleAtSlug(
  db: D1Database,
  staffUserId: string,
  slug: string,
): Promise<StaffAccess | null> {
  const row = await db
    .prepare(
      `SELECT p.id AS property_id, p.slug, p.timezone, m.role
       FROM staff_memberships m
       JOIN properties p ON p.id = m.property_id
       JOIN staff_users u ON u.id = m.staff_user_id
       WHERE m.staff_user_id = ?1 AND p.slug = ?2
         AND p.suspended_at IS NULL AND u.disabled_at IS NULL`,
    )
    .bind(staffUserId, slug)
    .first<{ property_id: string; slug: string; timezone: string; role: StaffRole }>();
  return row
    ? { propertyId: row.property_id, slug: row.slug, timezone: row.timezone, role: row.role }
    : null;
}
