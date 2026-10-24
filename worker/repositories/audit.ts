import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';

// Append-only: this module exports no update or delete (tests/node/meta.test.ts).

export interface AuditEntry {
  actorKind: 'staff' | 'system';
  actorStaffId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
}

/**
 * D-27: a person-level event (sign-in, sign-out, recovery, session or passkey change) belongs to a person
 * who may hold roles in several properties, so it is written once for each property they hold a role in.
 * A person with no role writes nothing. Takes the database first: the properties come from the person's
 * own memberships, never from the request.
 */
export async function appendForPerson(
  db: D1Database,
  staffUserId: string,
  entry: { action: string; targetType: string; targetId: string | null },
  now: number,
): Promise<number> {
  const { results } = await db
    .prepare('SELECT property_id FROM staff_memberships WHERE staff_user_id = ?1')
    .bind(staffUserId)
    .all<{ property_id: string }>();
  if (results.length === 0) return 0;
  await db.batch(
    results.map((m) =>
      db
        .prepare(
          `INSERT INTO audit_log (id, property_id, actor_kind, actor_staff_id, action, target_type, target_id, created_at)
           VALUES (?1, ?2, 'staff', ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(newId(), m.property_id, staffUserId, entry.action, entry.targetType, entry.targetId, now),
    ),
  );
  return results.length;
}

export interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorName: string | null;
  createdAt: number;
}

/** Newest first, one property only, a page at a time (`before` is the createdAt of the last row seen). */
export async function list(ctx: TenantContext, opts: { limit: number; before?: number; action?: string }): Promise<AuditRow[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, COALESCE(NULLIF(u.display_name, ''), u.email) AS actor_name
       FROM audit_log a LEFT JOIN staff_users u ON u.id = a.actor_staff_id
       WHERE a.property_id = ?1 AND (?2 IS NULL OR a.created_at < ?2) AND (?3 IS NULL OR a.action = ?3)
       ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?4`,
    )
    .bind(ctx.propertyId, opts.before ?? null, opts.action ?? null, Math.min(Math.max(opts.limit, 1), 200))
    .all<{ id: string; action: string; target_type: string; target_id: string | null; created_at: number; actor_name: string | null }>();
  return results.map((r) => ({ id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, actorName: r.actor_name, createdAt: r.created_at }));
}

export async function append(ctx: TenantContext, entry: AuditEntry, now: number): Promise<string> {
  const id = newId();
  await ctx.db
    .prepare(
      `INSERT INTO audit_log (id, property_id, actor_kind, actor_staff_id, action, target_type, target_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(id, ctx.propertyId, entry.actorKind, entry.actorStaffId, entry.action, entry.targetType, entry.targetId, now)
    .run();
  return id;
}
