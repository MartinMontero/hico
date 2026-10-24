import type { StaffRole } from '../tenant.ts';

// Invite and recovery links. Only the SHA-256 of the random token is stored; a link works once.

export interface TokenRow {
  purpose: 'invite' | 'recovery';
  email: string;
  displayName: string;
  propertyId: string | null;
  role: StaffRole | null;
  staffUserId: string | null;
}

interface Raw {
  purpose: 'invite' | 'recovery';
  email: string;
  display_name: string;
  property_id: string | null;
  role: StaffRole | null;
  staff_user_id: string | null;
}
const map = (r: Raw): TokenRow => ({ purpose: r.purpose, email: r.email, displayName: r.display_name, propertyId: r.property_id, role: r.role, staffUserId: r.staff_user_id });

export async function createInvite(
  db: D1Database,
  t: { hash: string; email: string; displayName: string; propertyId: string; role: StaffRole; createdBy: string | null },
  now: number,
  ttlSeconds: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO staff_tokens (token_hash, purpose, email, display_name, property_id, role, created_by, created_at, expires_at)
       VALUES (?1, 'invite', ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(t.hash, t.email, t.displayName, t.propertyId, t.role, t.createdBy, now, now + ttlSeconds)
    .run();
}

export async function createRecovery(
  db: D1Database,
  t: { hash: string; email: string; displayName: string; staffUserId: string; createdBy: string | null },
  now: number,
  ttlSeconds: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO staff_tokens (token_hash, purpose, email, display_name, staff_user_id, created_by, created_at, expires_at)
       VALUES (?1, 'recovery', ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(t.hash, t.email, t.displayName, t.staffUserId, t.createdBy, now, now + ttlSeconds)
    .run();
}

/** What a link is for, without using it. Unknown, used and expired links all give null. */
export async function inspect(db: D1Database, hash: string, now: number): Promise<TokenRow | null> {
  const r = await db
    .prepare('SELECT purpose, email, display_name, property_id, role, staff_user_id FROM staff_tokens WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2')
    .bind(hash, now)
    .first<Raw>();
  return r ? map(r) : null;
}

/** Uses a link exactly once: the second call finds nothing. */
export async function consume(db: D1Database, hash: string, now: number): Promise<TokenRow | null> {
  const r = await db
    .prepare(
      `UPDATE staff_tokens SET used_at = ?2 WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
       RETURNING purpose, email, display_name, property_id, role, staff_user_id`,
    )
    .bind(hash, now)
    .first<Raw>();
  return r ? map(r) : null;
}
