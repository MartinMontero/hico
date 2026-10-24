import type { TenantContext } from '../tenant.ts';

// Aggregate counters: (property, UTC day, event name) and a count. No session id, ever.
// Increment only: this module exports no update or delete of rows.

export async function increment(ctx: TenantContext, day: string, event: string): Promise<void> {
  await ctx.db
    .prepare(
      `INSERT INTO event_counts (property_id, day, event, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (property_id, day, event) DO UPDATE SET count = count + 1`,
    )
    .bind(ctx.propertyId, day, event)
    .run();
}

export async function countFor(ctx: TenantContext, day: string, event: string): Promise<number> {
  const row = await ctx.db
    .prepare('SELECT count FROM event_counts WHERE property_id = ?1 AND day = ?2 AND event = ?3')
    .bind(ctx.propertyId, day, event)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
