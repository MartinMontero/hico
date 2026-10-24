import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';
import type { Stamp } from './activities.ts';

export interface OfferRow {
  id: string;
  partner_name: string;
  terms_en: string;
  terms_fr: string;
  valid_from: number | null;
  valid_to: number | null;
  requires_membership: number;
  how_we_know_en: string;
  how_we_know_fr: string;
  verified_on: number | null;
  verified_by: string | null;
  is_placeholder: number;
}

const COLUMNS = `id, partner_name, terms_en, terms_fr, valid_from, valid_to, requires_membership,
  how_we_know_en, how_we_know_fr, verified_on, verified_by, is_placeholder`;

/** 09 §2: an offer is hidden if it is expired or has not been checked for 90 days. */
const NINETY_DAYS = 90 * 24 * 60 * 60;

export async function listShown(ctx: TenantContext, now: number): Promise<OfferRow[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT ${COLUMNS} FROM offers
       WHERE property_id = ?1
         AND verified_on IS NOT NULL AND verified_on >= ?2
         AND (valid_to IS NULL OR valid_to >= ?3)
         AND (valid_from IS NULL OR valid_from <= ?3)
       ORDER BY partner_name`,
    )
    .bind(ctx.propertyId, now - NINETY_DAYS, now)
    .all<OfferRow>();
  return results;
}

export async function getShown(ctx: TenantContext, id: string, now: number): Promise<OfferRow | null> {
  return ctx.db
    .prepare(
      `SELECT ${COLUMNS} FROM offers
       WHERE property_id = ?1 AND id = ?2
         AND verified_on IS NOT NULL AND verified_on >= ?3
         AND (valid_to IS NULL OR valid_to >= ?4)`,
    )
    .bind(ctx.propertyId, id, now - NINETY_DAYS, now)
    .first<OfferRow>();
}

// ---- Staff side ----

export interface StaffOfferRow extends OfferRow {
  version: number;
}

export interface OfferWrite {
  partnerName: string;
  termsEn: string;
  termsFr: string;
  validFrom: number | null;
  validTo: number | null;
  requiresMembership: boolean;
  howWeKnowEn: string;
  howWeKnowFr: string;
}

const STAFF_COLUMNS = `${COLUMNS}, version`;

/** Every offer of the property, including the ones guests do not see, oldest check first. */
export async function listForStaff(ctx: TenantContext): Promise<StaffOfferRow[]> {
  const { results } = await ctx.db
    .prepare(`SELECT ${STAFF_COLUMNS} FROM offers WHERE property_id = ?1 ORDER BY COALESCE(verified_on, 0), partner_name`)
    .bind(ctx.propertyId)
    .all<StaffOfferRow>();
  return results;
}

export async function getForStaff(ctx: TenantContext, id: string): Promise<StaffOfferRow | null> {
  return ctx.db.prepare(`SELECT ${STAFF_COLUMNS} FROM offers WHERE property_id = ?1 AND id = ?2`).bind(ctx.propertyId, id).first<StaffOfferRow>();
}

export async function insert(ctx: TenantContext, f: OfferWrite, stamp: Stamp, now: number): Promise<string> {
  const id = newId();
  await ctx.db
    .prepare(
      `INSERT INTO offers (id, property_id, partner_name, terms_en, terms_fr, valid_from, valid_to, requires_membership, how_we_know_en, how_we_know_fr,
         verified_on, verified_by, is_placeholder, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, ?13)`,
    )
    .bind(id, ctx.propertyId, f.partnerName, f.termsEn, f.termsFr, f.validFrom, f.validTo, f.requiresMembership ? 1 : 0, f.howWeKnowEn, f.howWeKnowFr, stamp.on, stamp.by, now)
    .run();
  return id;
}

async function outcome(ctx: TenantContext, id: string, changes: number): Promise<'ok' | 'conflict' | 'missing'> {
  if (changes > 0) return 'ok';
  return (await getForStaff(ctx, id)) ? 'conflict' : 'missing';
}

export async function update(ctx: TenantContext, id: string, version: number, f: OfferWrite, stamp: Stamp): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare(
      `UPDATE offers SET partner_name = ?4, terms_en = ?5, terms_fr = ?6, valid_from = ?7, valid_to = ?8, requires_membership = ?9,
         how_we_know_en = ?10, how_we_know_fr = ?11, verified_on = ?12, verified_by = ?13, is_placeholder = 0, version = version + 1
       WHERE property_id = ?1 AND id = ?2 AND version = ?3`,
    )
    .bind(ctx.propertyId, id, version, f.partnerName, f.termsEn, f.termsFr, f.validFrom, f.validTo, f.requiresMembership ? 1 : 0, f.howWeKnowEn, f.howWeKnowFr, stamp.on, stamp.by)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

export async function reverify(ctx: TenantContext, id: string, version: number, stamp: Stamp): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db
    .prepare('UPDATE offers SET verified_on = ?4, verified_by = ?5, is_placeholder = 0, version = version + 1 WHERE property_id = ?1 AND id = ?2 AND version = ?3')
    .bind(ctx.propertyId, id, version, stamp.on, stamp.by)
    .run();
  return outcome(ctx, id, r.meta.changes);
}

export async function remove(ctx: TenantContext, id: string, version: number): Promise<'ok' | 'conflict' | 'missing'> {
  const r = await ctx.db.prepare('DELETE FROM offers WHERE property_id = ?1 AND id = ?2 AND version = ?3').bind(ctx.propertyId, id, version).run();
  return outcome(ctx, id, r.meta.changes);
}