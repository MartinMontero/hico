import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';

// Append-only: this module exports no update or delete (tests/worker/isolation.test.ts).

export interface AuditEntry {
  actorKind: 'staff' | 'system';
  actorStaffId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
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
