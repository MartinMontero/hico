// WebAuthn challenges: single use, five minutes. Person-level, db first.

export interface ChallengeRow {
  challenge: string;
  staffUserId: string | null;
  tokenHash: string | null;
}

export async function create(
  db: D1Database,
  c: { id: string; challenge: string; purpose: 'register' | 'login'; staffUserId: string | null; tokenHash: string | null },
  now: number,
  ttlSeconds: number,
): Promise<void> {
  await db
    .prepare('INSERT INTO webauthn_challenges (id, challenge, purpose, staff_user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(c.id, c.challenge, c.purpose, c.staffUserId, c.tokenHash, now + ttlSeconds)
    .run();
}

/** Takes a challenge once. A challenge of one purpose cannot be spent on the other. */
export async function consume(db: D1Database, id: string, purpose: 'register' | 'login', now: number): Promise<ChallengeRow | null> {
  const r = await db
    .prepare(
      `UPDATE webauthn_challenges SET used_at = ?3 WHERE id = ?1 AND purpose = ?2 AND used_at IS NULL AND expires_at > ?3
       RETURNING challenge, staff_user_id, token_hash`,
    )
    .bind(id, purpose, now)
    .first<{ challenge: string; staff_user_id: string | null; token_hash: string | null }>();
  return r ? { challenge: r.challenge, staffUserId: r.staff_user_id, tokenHash: r.token_hash } : null;
}
