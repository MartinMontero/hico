// Person-level (a staff session belongs to a person, not to one property). Every function takes the
// database first and is a documented lookup like staff.roleAtSlug; none is reachable without a token.

export interface ActiveSession {
  staffUserId: string;
  sessionId: string;
}

export async function create(db: D1Database, tokenHash: string, staffUserId: string, now: number, ttlSeconds: number): Promise<void> {
  await db
    .prepare('INSERT INTO staff_sessions (id, staff_user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(tokenHash, staffUserId, now, now + ttlSeconds)
    .run();
}

/** The session for this token hash, if it is live and the person is not disabled. */
export async function findActive(db: D1Database, tokenHash: string, now: number): Promise<ActiveSession | null> {
  const row = await db
    .prepare(
      `SELECT s.staff_user_id, s.id FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id
       WHERE s.id = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.disabled_at IS NULL`,
    )
    .bind(tokenHash, now)
    .first<{ staff_user_id: string; id: string }>();
  return row ? { staffUserId: row.staff_user_id, sessionId: row.id } : null;
}

export interface SessionSummary {
  handle: string;
  createdAt: number;
  expiresAt: number;
  current: boolean;
}

/** A handle is the first 12 characters of the hash: enough to name a session, not enough to use it. */
export async function listFor(db: D1Database, staffUserId: string, currentId: string, now: number): Promise<SessionSummary[]> {
  const { results } = await db
    .prepare('SELECT id, created_at, expires_at FROM staff_sessions WHERE staff_user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2 ORDER BY created_at')
    .bind(staffUserId, now)
    .all<{ id: string; created_at: number; expires_at: number }>();
  return results.map((r) => ({ handle: r.id.slice(0, 12), createdAt: r.created_at, expiresAt: r.expires_at, current: r.id === currentId }));
}

export async function revokeByHandle(db: D1Database, staffUserId: string, handle: string, now: number): Promise<number> {
  const r = await db
    .prepare('UPDATE staff_sessions SET revoked_at = ?3 WHERE staff_user_id = ?1 AND substr(id, 1, 12) = ?2 AND revoked_at IS NULL')
    .bind(staffUserId, handle, now)
    .run();
  return r.meta.changes;
}

export async function revokeOne(db: D1Database, sessionId: string, now: number): Promise<void> {
  await db.prepare('UPDATE staff_sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL').bind(sessionId, now).run();
}

export async function revokeAllFor(db: D1Database, staffUserId: string, now: number): Promise<number> {
  const r = await db
    .prepare('UPDATE staff_sessions SET revoked_at = ?2 WHERE staff_user_id = ?1 AND revoked_at IS NULL')
    .bind(staffUserId, now)
    .run();
  return r.meta.changes;
}
