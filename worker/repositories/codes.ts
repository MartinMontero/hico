import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';

// QR labels (Stage 0: a labelled link, #l=<label>). token_hash stays empty until Stage 2 sessions (Phase 5).

export interface CodeRow {
  id: string;
  label: string;
  createdAt: number;
  retiredAt: number | null;
}

export async function list(ctx: TenantContext): Promise<CodeRow[]> {
  const { results } = await ctx.db
    .prepare('SELECT id, label, created_at, revoked_at FROM entry_codes WHERE property_id = ?1 ORDER BY revoked_at IS NOT NULL, label')
    .bind(ctx.propertyId)
    .all<{ id: string; label: string; created_at: number; revoked_at: number | null }>();
  return results.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, retiredAt: r.revoked_at }));
}

/** A label this property created and has not retired: the only kind a scan may count (05 §7). */
export async function isActiveLabel(ctx: TenantContext, label: string): Promise<boolean> {
  const row = await ctx.db
    .prepare('SELECT 1 AS found FROM entry_codes WHERE property_id = ?1 AND label = ?2 AND revoked_at IS NULL')
    .bind(ctx.propertyId, label)
    .first<{ found: number }>();
  return row !== null;
}

export async function insert(ctx: TenantContext, label: string, now: number): Promise<{ id: string } | 'exists'> {
  const id = newId();
  try {
    await ctx.db
      .prepare("INSERT INTO entry_codes (id, property_id, label, token_hash, created_at) VALUES (?1, ?2, ?3, '', ?4)")
      .bind(id, ctx.propertyId, label, now)
      .run();
    return { id };
  } catch {
    return 'exists'; // UNIQUE (property_id, label)
  }
}

export async function retire(ctx: TenantContext, id: string, now: number): Promise<boolean> {
  const r = await ctx.db
    .prepare('UPDATE entry_codes SET revoked_at = ?3 WHERE property_id = ?1 AND id = ?2 AND revoked_at IS NULL')
    .bind(ctx.propertyId, id, now)
    .run();
  return r.meta.changes > 0;
}
