import { bytesOf } from '../security.ts';

// Person-level passkeys. The public key is a BLOB; the credential id is the base64url text WebAuthn gives.

export interface CredentialRow {
  id: string;
  staffUserId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string;
}

export interface CredentialSummary {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/** An active credential whose person is not disabled: the only kind that may sign in. */
export async function findActive(db: D1Database, credentialId: string): Promise<CredentialRow | null> {
  const r = await db
    .prepare(
      `SELECT c.id, c.staff_user_id, c.public_key, c.counter, c.transports
       FROM staff_credentials c JOIN staff_users u ON u.id = c.staff_user_id
       WHERE c.id = ?1 AND c.revoked_at IS NULL AND u.disabled_at IS NULL`,
    )
    .bind(credentialId)
    .first<{ id: string; staff_user_id: string; public_key: unknown; counter: number; transports: string }>();
  return r ? { id: r.id, staffUserId: r.staff_user_id, publicKey: bytesOf(r.public_key), counter: r.counter, transports: r.transports } : null;
}

export async function listFor(db: D1Database, staffUserId: string): Promise<CredentialSummary[]> {
  const { results } = await db
    .prepare('SELECT id, label, created_at, last_used_at FROM staff_credentials WHERE staff_user_id = ?1 AND revoked_at IS NULL ORDER BY created_at')
    .bind(staffUserId)
    .all<{ id: string; label: string; created_at: number; last_used_at: number | null }>();
  return results.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function countActive(db: D1Database, staffUserId: string): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM staff_credentials WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(staffUserId).first<{ n: number }>();
  return r?.n ?? 0;
}

export async function insert(
  db: D1Database,
  c: { id: string; staffUserId: string; publicKey: Uint8Array; counter: number; transports: string; label: string },
  now: number,
): Promise<void> {
  await db
    .prepare('INSERT INTO staff_credentials (id, staff_user_id, public_key, counter, transports, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(c.id, c.staffUserId, c.publicKey, c.counter, c.transports, c.label, now)
    .run();
}

export async function recordUse(db: D1Database, credentialId: string, newCounter: number, now: number): Promise<void> {
  await db.prepare('UPDATE staff_credentials SET counter = ?2, last_used_at = ?3 WHERE id = ?1').bind(credentialId, newCounter, now).run();
}

/** Never removes a person's last active passkey: they would lock themselves out (D-26). */
export async function revoke(db: D1Database, staffUserId: string, credentialId: string, now: number): Promise<'revoked' | 'last' | 'missing'> {
  if ((await countActive(db, staffUserId)) < 2) return 'last';
  const r = await db
    .prepare('UPDATE staff_credentials SET revoked_at = ?3 WHERE id = ?1 AND staff_user_id = ?2 AND revoked_at IS NULL')
    .bind(credentialId, staffUserId, now)
    .run();
  return r.meta.changes > 0 ? 'revoked' : 'missing';
}

/** Recovery replaces access: every earlier passkey stops working. */
export async function revokeAllFor(db: D1Database, staffUserId: string, now: number): Promise<number> {
  const r = await db.prepare('UPDATE staff_credentials SET revoked_at = ?2 WHERE staff_user_id = ?1 AND revoked_at IS NULL').bind(staffUserId, now).run();
  return r.meta.changes;
}

export async function rename(db: D1Database, staffUserId: string, credentialId: string, label: string): Promise<boolean> {
  const r = await db
    .prepare('UPDATE staff_credentials SET label = ?3 WHERE id = ?1 AND staff_user_id = ?2 AND revoked_at IS NULL')
    .bind(credentialId, staffUserId, label)
    .run();
  return r.meta.changes > 0;
}
