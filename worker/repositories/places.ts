import type { TenantContext } from '../tenant.ts';
import type { PlaceCategory } from '../../shared/types.ts';
import { newId } from '../ids.ts';
import type { Stamp } from './activities.ts';

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

// ---- Staff side: every statement carries property_id; a write names the version it was based on. ----

export interface StaffPlaceRow extends PlaceRow {
  version: number;
}

export interface PlaceWrite {
  category: PlaceCategory;
  name: string;
  staffPick: boolean;
  noteEn: string;
  noteFr: string;
  walkTimeEn: string;
  walkTimeFr: string;
  hoursEn: string;
  hoursFr: string;
  phone: string | null;
  mapsAddress: string;
}

const STAFF_COLUMNS = `${COLUMNS}, version`;

/** Oldest check first (never-checked first of all): the order staff work down the list. */
export async function listForStaff(ctx: TenantContext): Promise<StaffPlaceRow[]> {
  const { results } = await ctx.db
    .prepare(`SELECT ${STAFF_COLUMNS} FROM places WHERE property_id = ?1 ORDER BY COALESCE(verified_on, 0), name`)
    .bind(ctx.propertyId)
    .all<StaffPlaceRow>();
  return results;
}

export async function getForStaff(ctx: TenantContext, id: string): Promise<StaffPlaceRow | null> {
  return ctx.db.prepare(`SELECT ${STAFF_COLUMNS} FROM places WHERE property_id = ?1 AND id = ?2`).bind(ctx.propertyId, id).first<StaffPlaceRow>();
}

export async function insert(ctx: TenantContext, f: PlaceWrite, stamp: Stamp, now: number): Promise<string> {
  const id = newId();
  await ctx.db
    .prepare(
      `INSERT INTO places (id, property_id, category, name, staff_pick, note_en, note_fr, walk_time_en, walk_time_fr, hours_en, hours_fr,
         phone, maps_address, verified_on, verified_by, is_placeholder, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 0, ?16, ?16)`,
    )
    .bind(id, ctx.propertyId, f.category, f.name, f.staffPick ? 1 : 0, f.noteEn, f.noteFr, f.walkTimeEn, f.walkTimeFr, f.hoursEn, f.hoursFr, f.phone, f.mapsAddress, stamp.on, stamp.by, now)
    .run();
  return id;
}

async function outcome(ctx: TenantContext, id: string, changes: number): Promise<'ok' | 'conflict' | 'missing'> {
  if (changes > 0) return 'ok';
  return (await getForStaff(ctx, id)) ? 'conflict' : 'missing';
}

export async function update(ctx: TenantContext, id: string, version: number, f: PlaceWrite, stamp: Stamp, now: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare(
      `UPDATE places SET category = ?4, name = ?5, staff_pick = ?6, note_en = ?7, note_fr = ?8, walk_time_en = ?9, walk_time_fr = ?10,
         hours_en = ?11, hours_fr = ?12, phone = ?13, maps_address = ?14, verified_on = ?15, verified_by = ?16, is_placeholder = 0,
         version = version + 1, updated_at = ?17
       WHERE property_id = ?1 AND id = ?2 AND version = ?3`,
    )
    .bind(ctx.propertyId, id, version, f.category, f.name, f.staffPick ? 1 : 0, f.noteEn, f.noteFr, f.walkTimeEn, f.walkTimeFr, f.hoursEn, f.hoursFr, f.phone, f.mapsAddress, stamp.on, stamp.by, now)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

export async function reverify(ctx: TenantContext, id: string, version: number, stamp: Stamp, now: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare('UPDATE places SET verified_on = ?4, verified_by = ?5, is_placeholder = 0, version = version + 1, updated_at = ?6 WHERE property_id = ?1 AND id = ?2 AND version = ?3')
    .bind(ctx.propertyId, id, version, stamp.on, stamp.by, now)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

export async function remove(ctx: TenantContext, id: string, version: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db.prepare('DELETE FROM places WHERE property_id = ?1 AND id = ?2 AND version = ?3').bind(ctx.propertyId, id, version).run();
  return outcome(ctx, id, r.meta.changes);
}