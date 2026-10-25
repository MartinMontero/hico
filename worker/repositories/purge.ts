import { retentionSeconds } from '../../shared/retention.ts';

// The retention purge (06 §2). Maintenance across every property, so these statements deliberately carry no
// property_id: they delete by age alone and return only how many rows went, never what they held. Each function takes
// the database, not a tenant context, and is called only by worker/purge.ts. shared/retention.ts holds the periods.

export interface PurgeCounts {
  staffSessions: number;
  staffTokens: number;
  challenges: number;
  rateLimits: number;
  retiredQrLabels: number;
  revokedPasskeys: number;
  auditLog: number;
}

async function deleted(db: D1Database, sql: string, ...binds: number[]): Promise<number> {
  const r = await db.prepare(sql).bind(...binds).run();
  return r.meta.changes;
}

export async function purgeExpired(db: D1Database, now: number): Promise<PurgeCounts> {
  const ago = (kind: Parameters<typeof retentionSeconds>[0]) => now - retentionSeconds(kind);
  return {
    // ended = expired, or ended early by the person; either way it stops working at that moment
    staffSessions: await deleted(db, 'DELETE FROM staff_sessions WHERE MIN(expires_at, COALESCE(revoked_at, expires_at)) < ?1', ago('endedStaffSessions')),
    staffTokens: await deleted(db, 'DELETE FROM staff_tokens WHERE MIN(expires_at, COALESCE(used_at, expires_at)) < ?1', ago('endedStaffLinks')),
    challenges: await deleted(db, 'DELETE FROM webauthn_challenges WHERE MIN(expires_at, COALESCE(used_at, expires_at)) < ?1', ago('endedChallenges')),
    rateLimits: await deleted(db, 'DELETE FROM rate_limits WHERE window_start < ?1', ago('rateLimitCounters')),
    retiredQrLabels: await deleted(db, 'DELETE FROM entry_codes WHERE revoked_at IS NOT NULL AND revoked_at < ?1', ago('retiredQrLabels')),
    revokedPasskeys: await deleted(db, 'DELETE FROM staff_credentials WHERE revoked_at IS NOT NULL AND revoked_at < ?1', ago('revokedPasskeys')),
    auditLog: await deleted(db, 'DELETE FROM audit_log WHERE created_at < ?1', ago('auditLog')),
  };
}