import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import {
  addHostnameSql, addressOf, createPropertySql, emailOf, hostOf, inviteSql, languagesOf, loadZonesSql, nameOf, newToken, propertyNameOf, recoverySql,
  remoteRefusal, runSql, slugOf, sqlText, timezoneOf, zonesOf,
} from './operator-lib.ts';

// node scripts/operator.ts <command> [--option value ...] [--origin http://localhost:5173] [--json] [--state-dir dir]
// The PowerShell wrappers in scripts\*.ps1 call this. LOCAL by default (wrangler d1 execute --local contacts nothing).
//
// --remote is a guarded path: it prints what it would do, needs the property slug (--slug) and a person at the
// keyboard who types that slug again, and even then stops without running anything: no remote command is approved in
// this phase (Phase 1b-2 brief). The gate is tested; the remote run itself is not written.
const COMMANDS = ['create-property', 'add-hostname', 'invite-first-admin', 'load-zones', 'issue-recovery-link'] as const;
const [command, ...rest] = process.argv.slice(2);
const opts = new Map<string, string>();
const flags = new Set<string>();
for (let i = 0; i < rest.length; i += 1) {
  const a = rest[i] as string;
  if (!a.startsWith('--')) throw new Error(`Unexpected argument ${a}`);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) flags.add(a.slice(2));
  else {
    opts.set(a.slice(2), next);
    i += 1;
  }
}
const origin = opts.get('origin') ?? 'http://localhost:5173';
const stateDir = opts.get('state-dir');
const now = Math.floor(Date.now() / 1000);
const local = { remote: false, stateDir } as const;

function show(link: string, what: string): void {
  if (flags.has('json')) console.log(JSON.stringify({ link }));
  else console.log(`${what}\n  ${link}\n  Shown once, valid for 30 minutes, works once. It is not stored anywhere else.`);
}

function requireProperty(slug: string): void {
  if (runSql(`SELECT id FROM properties WHERE slug = ${sqlText(slug)};`, local).length === 0) throw new Error(`No property with slug ${slug} in the local database.`);
}

/** What a command would write, in words, for the -Remote confirmation. Never includes a token. */
function describe(): string {
  const slug = opts.get('slug') ?? '(none)';
  switch (command) {
    case 'create-property':
      return `insert one row into properties (slug ${slug}) and one audit_log row`;
    case 'add-hostname':
      return `insert one row into property_hosts (host ${opts.get('host') ?? '?'} for ${slug}) and one audit_log row`;
    case 'invite-first-admin':
      return `insert one staff_tokens row (an admin invite, hash only, for ${opts.get('email') ?? '?'} at ${slug}) and one audit_log row`;
    case 'load-zones':
      return `insert the zones listed in ${opts.get('file') ?? '?'} into zones for ${slug}, and one audit_log row`;
    default:
      return `insert one staff_tokens row (a recovery link, hash only, for ${opts.get('email') ?? '?'}) and audit_log rows for each property that person belongs to`;
  }
}

async function remoteGate(): Promise<never> {
  const slug = opts.get('slug');
  console.error('REMOTE REQUESTED. Nothing has been run.');
  console.error(`  command:  ${command}`);
  console.error(`  database: the remote D1 database of the Worker you name (hico-preview or hico-prod)`);
  console.error(`  property: ${slug ?? '(not given)'}`);
  console.error(`  it would: ${describe()}`);
  const interactive = Boolean(process.stdin.isTTY);
  let typed: string | undefined;
  if (slug && interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    typed = await rl.question(`Type the property slug (${slug}) to confirm: `);
    rl.close();
  }
  const refusal = remoteRefusal({ slug, typed, interactive });
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  console.error('Confirmed, but remote execution is not enabled in this phase. Nothing was run.');
  process.exit(2);
}

async function main(): Promise<void> {
  if (!command || !(COMMANDS as readonly string[]).includes(command)) throw new Error(`Unknown command ${command ?? '(none)'}. Known: ${COMMANDS.join(', ')}.`);
  if (flags.has('remote') || opts.has('remote')) return remoteGate();

  if (command === 'create-property') {
    const slug = slugOf(opts.get('slug'));
    const { id, sql } = createPropertySql({
      slug,
      nameEn: propertyNameOf(opts.get('name-en'), 'English name'),
      nameFr: propertyNameOf(opts.get('name-fr') ?? opts.get('name-en'), 'French name'),
      timezone: timezoneOf(opts.get('timezone')),
      address: addressOf(opts.get('address')),
      languages: languagesOf(opts.get('languages')),
      now,
    });
    if (runSql(`SELECT id FROM properties WHERE slug = ${sqlText(slug)};`, local).length > 0) throw new Error(`A property with slug ${slug} already exists.`);
    runSql(sql, local);
    console.log(`Created property ${slug} (id ${id}). It has no hostname, no zones and no staff yet: add-hostname, load-zones, invite-first-admin.`);
  } else if (command === 'add-hostname') {
    const slug = slugOf(opts.get('slug'));
    const host = hostOf(opts.get('host'));
    const isDefault = flags.has('default');
    requireProperty(slug);
    const onHost = runSql(`SELECT p.slug AS slug, h.is_default AS is_default FROM property_hosts h JOIN properties p ON p.id = h.property_id WHERE h.host = ${sqlText(host)};`, local);
    if (onHost.some((r) => r['slug'] === slug)) throw new Error(`${host} already serves ${slug}.`);
    if (isDefault && onHost.some((r) => r['is_default'] === 1)) throw new Error(`${host} already has a default property. Change that on purpose, not by accident.`);
    runSql(addHostnameSql({ slug, host, isDefault, now }), local);
    const others = onHost.map((r) => String(r['slug']));
    console.log(`Added ${host} for ${slug}${isDefault ? ' as its default property' : ''}.`);
    if (others.length > 0) console.log(`  ${host} now serves ${others.length + 1} properties; guests reach each at /p/<slug> (${[...others, slug].join(', ')}).`);
  } else if (command === 'invite-first-admin') {
    const slug = slugOf(opts.get('slug'));
    const email = emailOf(opts.get('email'));
    const displayName = nameOf(opts.get('name'));
    const { token, hash } = newToken();
    requireProperty(slug);
    runSql(inviteSql({ slug, email, displayName, role: 'admin', hash, now }), local);
    show(`${origin}/staff/accept#invite=${token}`, `First-admin invite for ${email} at ${slug}:`);
  } else if (command === 'load-zones') {
    const slug = slugOf(opts.get('slug'));
    const file = opts.get('file');
    if (!file) throw new Error('--file <zones.json> is required.');
    const zones = zonesOf(readFileSync(file, 'utf8'));
    requireProperty(slug);
    const have = runSql(`SELECT label_en FROM zones WHERE property_id = ${`(SELECT id FROM properties WHERE slug = ${sqlText(slug)})`};`, local).map((r) => String(r['label_en']).toLowerCase());
    const clash = zones.find((z) => have.includes(z.en.toLowerCase()));
    if (clash) throw new Error(`${slug} already has a zone called "${clash.en}". Nothing was loaded.`);
    runSql(loadZonesSql({ slug, zones, now }), local);
    console.log(`Loaded ${zones.length} zone${zones.length === 1 ? '' : 's'} for ${slug}.`);
  } else {
    const email = emailOf(opts.get('email'));
    const { token, hash } = newToken();
    const found = runSql(`SELECT id FROM staff_users WHERE email = ${sqlText(email)} AND disabled_at IS NULL;`, local);
    if (found.length === 0) throw new Error('No active staff person with that email in the local database.');
    runSql(recoverySql({ email, hash, now }), local);
    show(`${origin}/staff/accept#recover=${token}`, `Recovery link for ${email}:`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
