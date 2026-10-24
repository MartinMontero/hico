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
  /** A throwaway local database directory (wrangler --persist-to), used by the tests. Default: the project's local state. */
  stateDir?: string;
}

/** Runs SQL on the local D1 (wrangler d1 execute --local, which contacts nothing) and returns the result rows. */
export function runSql(sql: string, target: D1Target): Record<string, unknown>[] {
  if (target.remote) throw new Error('Remote execution is refused here: use the -Remote path in operator.ts, which asks first.');
  mkdirSync('.wrangler', { recursive: true });
  const file = '.wrangler/operator.sql';
  writeFileSync(file, sql);
  const persist = target.stateDir ? ['--persist-to', target.stateDir] : [];
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '--file', file, '--json'], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
  });
  if (r.status !== 0) throw new Error(`wrangler failed:\n${r.stdout}${r.stderr}`);
  const start = r.stdout.indexOf('[');
  const parsed = JSON.parse(r.stdout.slice(start)) as { results?: Record<string, unknown>[] }[];
  return parsed.flatMap((p) => p.results ?? []);
}

export const timezoneOf = (value: unknown): string => {
  const zone = parse(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.timezone)), value, 'time zone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
  } catch {
    throw new Error(`time zone is not acceptable (${zone} is not an IANA zone name, for example America/Vancouver)`);
  }
  return zone;
};
export const languagesOf = (value: unknown) => parse(v.picklist(['en', 'fr', 'en,fr']), value ?? 'en,fr', 'languages');
export const propertyNameOf = (value: unknown, what: string) => parse(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.name)), value, what);
export const addressOf = (value: unknown) => parse(v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.address)), value ?? '', 'address');

const zoneEntry = v.object({
  en: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.label)),
  fr: v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.label)),
  ring: v.picklist(['in_hostel', 'short_walk', 'further']),
});
export type ZoneEntry = v.InferOutput<typeof zoneEntry>;
/** The zones file: a JSON array of { en, fr, ring }, at most 50, no two with the same English name. */
export function zonesOf(text: string): ZoneEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('the zones file is not valid JSON');
  }
  const zones = parse(v.pipe(v.array(zoneEntry), v.minLength(1), v.maxLength(50)), raw, 'zones file');
  const seen = new Set<string>();
  for (const z of zones) {
    if (seen.has(z.en.toLowerCase())) throw new Error(`the zones file lists "${z.en}" twice`);
    seen.add(z.en.toLowerCase());
  }
  return zones;
}

const auditSql = (propertyIdExpr: string, action: string, targetType: string, targetIdExpr: string, now: number) =>
  `INSERT INTO audit_log (id, property_id, actor_kind, action, target_type, target_id, created_at)
    SELECT ${sqlText(randomId())}, id, 'system', ${sqlText(action)}, ${sqlText(targetType)}, ${targetIdExpr}, ${now} FROM properties WHERE id = ${propertyIdExpr};`;

export function createPropertySql(o: { slug: string; nameEn: string; nameFr: string; timezone: string; address: string; languages: string; now: number }): { id: string; sql: string } {
  const id = randomId();
  const insert = `INSERT INTO properties (id, slug, name_en, name_fr, timezone, address, languages, created_at)
    VALUES (${sqlText(id)}, ${sqlText(o.slug)}, ${sqlText(o.nameEn)}, ${sqlText(o.nameFr)}, ${sqlText(o.timezone)}, ${sqlText(o.address)}, ${sqlText(o.languages)}, ${o.now});`;
  return { id, sql: `${insert}\n${auditSql(sqlText(id), 'operator.property.created', 'property', sqlText(id), o.now)}\n` };
}

export function addHostnameSql(o: { slug: string; host: string; isDefault: boolean; now: number }): string {
  const insert = `INSERT INTO property_hosts (id, host, property_id, is_default)
    SELECT ${sqlText(randomId())}, ${sqlText(o.host)}, id, ${o.isDefault ? 1 : 0} FROM properties WHERE slug = ${sqlText(o.slug)};`;
  return `${insert}\n${auditSql(propertyIdSql(o.slug), 'operator.host.added', 'property', 'NULL', o.now)}\n`;
}

export function loadZonesSql(o: { slug: string; zones: ZoneEntry[]; now: number }): string {
  const rows = o.zones.map(
    (z) => `INSERT INTO zones (id, property_id, label_en, label_fr, ring)
    SELECT ${sqlText(randomId())}, id, ${sqlText(z.en)}, ${sqlText(z.fr)}, ${sqlText(z.ring)} FROM properties WHERE slug = ${sqlText(o.slug)};`,
  );
  return `${rows.join('\n')}\n${auditSql(propertyIdSql(o.slug), 'operator.zones.loaded', 'zone', 'NULL', o.now)}\n`;
}

/**
 * The only gate in front of a remote database. Remote use needs a person at the keyboard who types the property
 * slug. Returns the reason for refusing, or null when the confirmation is complete. (Even then nothing is run in
 * this phase: operator.ts stops after the confirmation, because no remote command is approved.)
 */
export function remoteRefusal(o: { slug: string | undefined; typed: string | undefined; interactive: boolean }): string | null {
  if (!o.slug) return 'Remote use needs --slug <property>: the command names the one property it touches.';
  if (!o.interactive) return 'Remote use needs a person at the keyboard to type the property slug. This session is not interactive, so nothing was run.';
  if (o.typed === undefined || o.typed.trim() !== o.slug) return 'The slug you typed does not match. Nothing was run.';
  return null;
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
