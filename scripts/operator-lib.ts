import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as v from 'valibot';
import { LIMITS } from '../shared/limits.ts';
import { displayNameSchema, emailSchema } from '../shared/staff-schemas.ts';
import { slugSchema } from '../shared/schemas.ts';

// The operator's side of the system (Martin, through scripts): it writes only what the app itself would
// accept, using the app's own schemas and limits. LOCAL by default; remote use is gated in operator.ts.

export const LINK_SECONDS = 30 * 60;

export function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function randomId(): string {
  return randomBytes(16).toString('hex');
}

/** A random 256-bit token and the SHA-256 the database stores, the same shape the Worker uses. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export function parse<T>(schema: v.GenericSchema<unknown, T>, value: unknown, what: string): T {
  const r = v.safeParse(schema, value);
  if (!r.success) throw new Error(`${what} is not acceptable (${r.issues[0]?.message ?? 'invalid'})`);
  return r.output;
}

export const slugOf = (value: unknown) => parse(slugSchema, value, 'slug');
export const emailOf = (value: unknown) => parse(emailSchema, value, 'email');
export const nameOf = (value: unknown) => parse(displayNameSchema, value, 'display name');
export const hostOf = (value: unknown) =>
  parse(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.maxLength(LIMITS.host), v.regex(/^[a-z0-9.-]+$/)), value, 'hostname');

export interface D1Target {
  remote: boolean;
}

/** Runs SQL on the local D1 (wrangler d1 execute --local, which contacts nothing) and returns the result rows. */
export function runSql(sql: string, target: D1Target): Record<string, unknown>[] {
  if (target.remote) throw new Error('Remote execution is refused here: use the -Remote path in operator.ts, which asks first.');
  mkdirSync('.wrangler', { recursive: true });
  const file = '.wrangler/operator.sql';
  writeFileSync(file, sql);
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--file', file, '--json'], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
  });
  if (r.status !== 0) throw new Error(`wrangler failed:\n${r.stdout}${r.stderr}`);
  const start = r.stdout.indexOf('[');
  const parsed = JSON.parse(r.stdout.slice(start)) as { results?: Record<string, unknown>[] }[];
  return parsed.flatMap((p) => p.results ?? []);
}

export function propertyIdSql(slug: string): string {
  return `(SELECT id FROM properties WHERE slug = ${sqlText(slug)})`;
}

/** The SQL that creates an invite link for a role at a property, written as the system (not as a person). */
export function inviteSql(o: { slug: string; email: string; displayName: string; role: 'admin' | 'editor'; hash: string; now: number }): string {
  const audit = `INSERT INTO audit_log (id, property_id, actor_kind, action, target_type, target_id, created_at)
    SELECT ${sqlText(randomId())}, id, 'system', 'operator.invite.created', 'invite', NULL, ${o.now} FROM properties WHERE slug = ${sqlText(o.slug)};`;
  const token = `INSERT INTO staff_tokens (token_hash, purpose, email, display_name, property_id, role, created_at, expires_at)
    SELECT ${sqlText(o.hash)}, 'invite', ${sqlText(o.email)}, ${sqlText(o.displayName)}, id, ${sqlText(o.role)}, ${o.now}, ${o.now + LINK_SECONDS} FROM properties WHERE slug = ${sqlText(o.slug)};`;
  return `${token}\n${audit}\n`;
}

/** A recovery link for a person, whatever properties they are in. The operator may; an admin of one property may not (people.canIssueRecovery). */
export function recoverySql(o: { email: string; hash: string; now: number }): string {
  return `INSERT INTO staff_tokens (token_hash, purpose, email, display_name, staff_user_id, created_at, expires_at)
    SELECT ${sqlText(o.hash)}, 'recovery', email, COALESCE(display_name, ''), id, ${o.now}, ${o.now + LINK_SECONDS} FROM staff_users WHERE email = ${sqlText(o.email)} AND disabled_at IS NULL;
  INSERT INTO audit_log (id, property_id, actor_kind, action, target_type, target_id, created_at)
    SELECT ${sqlText(randomId())}, m.property_id, 'system', 'operator.recovery.issued', 'staff', u.id, ${o.now}
    FROM staff_users u JOIN staff_memberships m ON m.staff_user_id = u.id WHERE u.email = ${sqlText(o.email)};\n`;
}
