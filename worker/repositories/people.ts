import type { StaffRole, TenantContext } from '../tenant.ts';

// Staff people and their roles. The person-level lookups take the database first (documented lookups,
// like staff.roleAtSlug); the property-scoped functions take the tenant context and carry property_id.

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  disabled: boolean;
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const r = await db
    .prepare('SELECT id, email, COALESCE(display_name, \'\') AS display_name, disabled_at FROM staff_users WHERE email = ?1')
    .bind(email)
    .first<{ id: string; email: string; display_name: string; disabled_at: number | null }>();
  return r ? { id: r.id, email: r.email, displayName: r.display_name, disabled: r.disabled_at !== null } : null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const r = await db
    .prepare('SELECT id, email, COALESCE(display_name, \'\') AS display_name, disabled_at FROM staff_users WHERE id = ?1')
    .bind(id)
    .first<{ id: string; email: string; display_name: string; disabled_at: number | null }>();
  return r ? { id: r.id, email: r.email, displayName: r.display_name, disabled: r.disabled_at !== null } : null;
}

export async function createUser(db: D1Database, u: { id: string; email: string; displayName: string }, now: number): Promise<void> {
  await db
    .prepare('INSERT INTO staff_users (id, email, display_name, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(u.id, u.email, u.displayName, now)
    .run();
}

export async function setDisplayName(db: D1Database, id: string, displayName: string): Promise<void> {
  await db.prepare('UPDATE staff_users SET display_name = ?2 WHERE id = ?1').bind(id, displayName).run();
}

export interface MembershipSummary {
  propertyId: string;
  slug: string;
  nameEn: string;
  nameFr: string;
  role: StaffRole;
}

/** Every property this person holds a role in (not suspended). Used for /me and for the audit fan-out. */
export async function membershipsOf(db: D1Database, staffUserId: string): Promise<MembershipSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.slug, p.name_en, p.name_fr, m.role
       FROM staff_memberships m JOIN properties p ON p.id = m.property_id
       WHERE m.staff_user_id = ?1 AND p.suspended_at IS NULL ORDER BY p.slug`,
    )
    .bind(staffUserId)
    .all<{ id: string; slug: string; name_en: string; name_fr: string; role: StaffRole }>();
  return results.map((r) => ({ propertyId: r.id, slug: r.slug, nameEn: r.name_en, nameFr: r.name_fr, role: r.role }));
}

/** Insert a role. False if the person already has one there (nothing is changed). */
export async function addMembership(db: D1Database, staffUserId: string, propertyId: string, role: StaffRole): Promise<boolean> {
  const r = await db
    .prepare('INSERT OR IGNORE INTO staff_memberships (staff_user_id, property_id, role) VALUES (?1, ?2, ?3)')
    .bind(staffUserId, propertyId, role)
    .run();
  return r.meta.changes > 0;
}

/**
 * Recovery replaces a person's access everywhere (sessions and passkeys are person-level). So the issuer
 * must be an admin of EVERY property the person holds a role in; otherwise an admin of A could take over
 * someone who is also an admin of B. Anything else goes through the operator.
 */
export async function canIssueRecovery(db: D1Database, issuerId: string, targetId: string): Promise<boolean> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN EXISTS (SELECT 1 FROM staff_memberships i WHERE i.staff_user_id = ?1 AND i.property_id = t.property_id AND i.role = 'admin') THEN 1 ELSE 0 END) AS covered
       FROM staff_memberships t WHERE t.staff_user_id = ?2`,
    )
    .bind(issuerId, targetId)
    .first<{ total: number; covered: number | null }>();
  return (r?.total ?? 0) > 0 && (r?.covered ?? 0) === r?.total;
}

export interface PersonRow {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  passkeys: number;
  lastSignInAt: number | null;
}

export async function listForProperty(ctx: TenantContext): Promise<PersonRow[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT u.id, u.email, COALESCE(u.display_name, '') AS display_name, m.role,
              (SELECT COUNT(*) FROM staff_credentials c WHERE c.staff_user_id = u.id AND c.revoked_at IS NULL) AS passkeys,
              (SELECT MAX(c.last_used_at) FROM staff_credentials c WHERE c.staff_user_id = u.id) AS last_sign_in
       FROM staff_memberships m JOIN staff_users u ON u.id = m.staff_user_id
       WHERE m.property_id = ?1 AND u.disabled_at IS NULL
       ORDER BY m.role, u.display_name, u.email`,
    )
    .bind(ctx.propertyId)
    .all<{ id: string; email: string; display_name: string; role: StaffRole; passkeys: number; last_sign_in: number | null }>();
  return results.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name, role: r.role, passkeys: r.passkeys, lastSignInAt: r.last_sign_in }));
}

export async function roleOf(ctx: TenantContext, staffUserId: string): Promise<StaffRole | null> {
  const r = await ctx.db
    .prepare('SELECT role FROM staff_memberships WHERE property_id = ?1 AND staff_user_id = ?2')
    .bind(ctx.propertyId, staffUserId)
    .first<{ role: StaffRole }>();
  return r?.role ?? null;
}

async function adminCount(ctx: TenantContext): Promise<number> {
  const r = await ctx.db
    .prepare("SELECT COUNT(*) AS n FROM staff_memberships m JOIN staff_users u ON u.id = m.staff_user_id WHERE m.property_id = ?1 AND m.role = 'admin' AND u.disabled_at IS NULL")
    .bind(ctx.propertyId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** An admin cannot demote the last admin of a property: nobody would be left to manage it. */
export async function setRole(ctx: TenantContext, staffUserId: string, role: StaffRole): Promise<'ok' | 'last_admin' | 'missing'> {
  const current = await roleOf(ctx, staffUserId);
  if (!current) return 'missing';
  if (current === 'admin' && role !== 'admin' && (await adminCount(ctx)) < 2) return 'last_admin';
  await ctx.db.prepare('UPDATE staff_memberships SET role = ?3 WHERE property_id = ?1 AND staff_user_id = ?2').bind(ctx.propertyId, staffUserId, role).run();
  return 'ok';
}

export async function removeMember(ctx: TenantContext, staffUserId: string): Promise<'ok' | 'last_admin' | 'missing'> {
  const current = await roleOf(ctx, staffUserId);
  if (!current) return 'missing';
  if (current === 'admin' && (await adminCount(ctx)) < 2) return 'last_admin';
  await ctx.db.prepare('DELETE FROM staff_memberships WHERE property_id = ?1 AND staff_user_id = ?2').bind(ctx.propertyId, staffUserId).run();
  return 'ok';
}
