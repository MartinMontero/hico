import type { TenantContext } from '../tenant.ts';
import type { FeatureName } from '../../shared/types.ts';

// Feature switches per property, default off. Reading is properties.listFeatures.

export async function set(ctx: TenantContext, feature: FeatureName, enabled: boolean, staffUserId: string, now: number): Promise<void> {
  await ctx.db
    .prepare(
      `INSERT INTO property_features (property_id, feature, enabled, changed_by, changed_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (property_id, feature) DO UPDATE SET enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = excluded.changed_at`,
    )
    .bind(ctx.propertyId, feature, enabled ? 1 : 0, staffUserId, now)
    .run();
}
