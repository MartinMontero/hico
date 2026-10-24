import type { TenantContext } from '../tenant.ts';

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
