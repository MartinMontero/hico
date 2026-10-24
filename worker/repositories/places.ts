import type { TenantContext } from '../tenant.ts';
import type { PlaceCategory } from '../../shared/types.ts';

export interface PlaceRow {
  id: string;
  category: PlaceCategory;
  name: string;
  staff_pick: number;
  note_en: string;
  note_fr: string;
  walk_time_en: string;
  walk_time_fr: string;
  hours_en: string;
  hours_fr: string;
  phone: string | null;
  maps_address: string;
  verified_on: number | null;
  verified_by: string | null;
  is_placeholder: number;
}

const COLUMNS = `id, category, name, staff_pick, note_en, note_fr, walk_time_en, walk_time_fr,
  hours_en, hours_fr, phone, maps_address, verified_on, verified_by, is_placeholder`;

export async function list(ctx: TenantContext): Promise<PlaceRow[]> {
  const { results } = await ctx.db
    .prepare(`SELECT ${COLUMNS} FROM places WHERE property_id = ?1 ORDER BY category, staff_pick DESC, name`)
    .bind(ctx.propertyId)
    .all<PlaceRow>();
  return results;
}

export async function getById(ctx: TenantContext, id: string): Promise<PlaceRow | null> {
  return ctx.db
    .prepare(`SELECT ${COLUMNS} FROM places WHERE property_id = ?1 AND id = ?2`)
    .bind(ctx.propertyId, id)
    .first<PlaceRow>();
}
