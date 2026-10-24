import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';

// The named places inside a hostel (Lobby, Deck...). Every statement carries property_id.

export type Ring = 'in_hostel' | 'short_walk' | 'further';

export interface ZoneRow {
  id: string;
  labelEn: string;
  labelFr: string;
  ring: Ring;
  inUse: boolean;
  version: number;
}

export interface ZoneWrite {
  labelEn: string;
  labelFr: string;
  ring: Ring;
}

interface Raw {
  id: string;
  label_en: string;
  label_fr: string;
  ring: Ring;
  in_use: number;
  version: number;
}
const COLUMNS = `z.id, z.label_en, z.label_fr, z.ring, z.version,
  EXISTS (SELECT 1 FROM activities a WHERE a.zone_id = z.id AND a.property_id = z.property_id) AS in_use`;
const map = (r: Raw): ZoneRow => ({ id: r.id, labelEn: r.label_en, labelFr: r.label_fr, ring: r.ring, inUse: r.in_use === 1, version: r.version });

export async function list(ctx: TenantContext): Promise<ZoneRow[]> {
  const { results } = await ctx.db.prepare(`SELECT ${COLUMNS} FROM zones z WHERE z.property_id = ?1 ORDER BY z.ring, z.label_en`).bind(ctx.propertyId).all<Raw>();
  return results.map(map);
}

export async function getById(ctx: TenantContext, id: string): Promise<ZoneRow | null> {
  const r = await ctx.db.prepare(`SELECT ${COLUMNS} FROM zones z WHERE z.property_id = ?1 AND z.id = ?2`).bind(ctx.propertyId, id).first<Raw>();
  return r ? map(r) : null;
}

export async function insert(ctx: TenantContext, f: ZoneWrite): Promise<string> {
  const id = newId();
  await ctx.db
    .prepare('INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(id, ctx.propertyId, f.labelEn, f.labelFr, f.ring)
    .run();
  return id;
}

export async function update(ctx: TenantContext, id: string, version: number, f: ZoneWrite): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare('UPDATE zones SET label_en = ?4, label_fr = ?5, ring = ?6, version = version + 1 WHERE property_id = ?1 AND id = ?2 AND version = ?3')
    .bind(ctx.propertyId, id, version, f.labelEn, f.labelFr, f.ring)
    .run();
  if (r.meta.changes > 0) return 'ok';
  return (await getById(ctx, id)) ? 'conflict' : 'missing';
}

/** A zone an activity still uses cannot be removed: the composite foreign key refuses it. */
export async function remove(ctx: TenantContext, id: string, version: number): Promise<'ok' | 'conflict' | 'missing' | 'in_use'> {
  try {
    const r = await ctx.db.prepare('DELETE FROM zones WHERE property_id = ?1 AND id = ?2 AND version = ?3').bind(ctx.propertyId, id, version).run();
    if (r.meta.changes > 0) return 'ok';
    return (await getById(ctx, id)) ? 'conflict' : 'missing';
  } catch {
    return 'in_use';
  }
}
