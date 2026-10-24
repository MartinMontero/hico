import type { Bilingual } from '../../shared/types.ts';

export interface HostProperty {
  propertyId: string;
  slug: string;
  name: Bilingual;
  timezone: string;
  isDefault: boolean;
}

interface HostRow {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  timezone: string;
  is_default: number;
}

/**
 * EXEMPT from the "every statement carries property_id" rule, by design (05 §4 rule 1):
 * this is the lookup that decides the property from the request hostname. It returns only
 * the properties listed for that host, and only public fields.
 */
export async function listPropertiesForHost(db: D1Database, host: string): Promise<HostProperty[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.slug, p.name_en, p.name_fr, p.timezone, h.is_default
       FROM property_hosts h
       JOIN properties p ON p.id = h.property_id
       WHERE h.host = ?1 AND p.suspended_at IS NULL
       ORDER BY p.slug`,
    )
    .bind(host)
    .all<HostRow>();
  return results.map((r) => ({
    propertyId: r.id,
    slug: r.slug,
    name: { en: r.name_en, fr: r.name_fr },
    timezone: r.timezone,
    isDefault: r.is_default === 1,
  }));
}
