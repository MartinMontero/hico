import type { TenantContext } from '../tenant.ts';
import type { FeatureName } from '../../shared/types.ts';

export interface PropertyRow {
  slug: string;
  nameEn: string;
  nameFr: string;
  timezone: string;
  languages: string;
  hasPlaceholders: boolean;
}

export async function getOwn(ctx: TenantContext): Promise<PropertyRow | null> {
  const row = await ctx.db
    .prepare(
      `SELECT p.slug, p.name_en, p.name_fr, p.timezone, p.languages,
         (EXISTS (SELECT 1 FROM activity_offered_at o
                  JOIN activities a ON a.id = o.activity_id AND a.property_id = o.owner_property_id
                  WHERE o.property_id = ?1 AND a.is_placeholder = 1)
          OR EXISTS (SELECT 1 FROM places pl WHERE pl.property_id = ?1 AND pl.is_placeholder = 1)
          OR EXISTS (SELECT 1 FROM offers f WHERE f.property_id = ?1 AND f.is_placeholder = 1)
         ) AS has_placeholders
       FROM properties p
       WHERE p.id = ?1 AND p.suspended_at IS NULL`,
    )
    .bind(ctx.propertyId)
    .first<{
      slug: string;
      name_en: string;
      name_fr: string;
      timezone: string;
      languages: string;
      has_placeholders: number;
    }>();
  return row
    ? {
        slug: row.slug,
        nameEn: row.name_en,
        nameFr: row.name_fr,
        timezone: row.timezone,
        languages: row.languages,
        hasPlaceholders: row.has_placeholders === 1,
      }
    : null;
}

/** A feature that has no row is off. */
export async function listFeatures(ctx: TenantContext): Promise<Record<FeatureName, boolean>> {
  const { results } = await ctx.db
    .prepare('SELECT feature, enabled FROM property_features WHERE property_id = ?1')
    .bind(ctx.propertyId)
    .all<{ feature: FeatureName; enabled: number }>();
  const out: Record<FeatureName, boolean> = { common_room: false, connect: false };
  for (const r of results) out[r.feature] = r.enabled === 1;
  return out;
}
