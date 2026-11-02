import type { TenantContext } from '../tenant.ts';

// Aggregate counters: (property, UTC day, event name) and a count. No session id, ever.
// This module exports no update or delete of rows; the staff report is read-only.

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

export interface CountRow {
  day: string;
  event: string;
  count: number;
}

/** Read-only staff report. The tenant context supplies the only property filter. */
export async function listFor(ctx: TenantContext, day?: string): Promise<CountRow[]> {
  const where = day ? ' AND day = ?2' : '';
  const statement = ctx.db.prepare(`SELECT day, event, count FROM event_counts WHERE property_id = ?1${where} ORDER BY day DESC, event ASC`);
  const rows = day ? statement.bind(ctx.propertyId, day) : statement.bind(ctx.propertyId);
  return (await rows.all<CountRow>()).results;
}
