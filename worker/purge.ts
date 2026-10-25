import { purge } from './repositories/index.ts';
import type { PurgeCounts } from './repositories/purge.ts';

/** The scheduled purge (06 §2). Logs only the counts: no row contents, no ids, no names. */
export async function runPurge(env: { DB: D1Database }, now: number): Promise<PurgeCounts> {
  const counts = await purge.purgeExpired(env.DB, now);
  console.log(JSON.stringify({ job: 'purge', ...counts }));
  return counts;
}