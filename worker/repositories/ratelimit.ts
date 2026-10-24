// Fixed-window counters. `key` is already a keyed hash (see worker/ratelimit.ts); nothing here sees an address.

const DAY = 24 * 3600;

/** Counts one hit in the window and says whether it is still within the limit. Old rows go on write. */
export async function hit(db: D1Database, key: string, limit: number, windowSeconds: number, now: number): Promise<boolean> {
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - DAY).run();
  return (row?.count ?? 1) <= limit;
}
