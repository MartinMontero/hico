/** Platform-wide switch (not tenant data; changed by the operator only). */
export async function getFlag(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM platform_flags WHERE key = ?1')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}
