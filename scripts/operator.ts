import { emailOf, inviteSql, newToken, nameOf, recoverySql, runSql, slugOf } from './operator-lib.ts';

// node scripts/operator.ts <command> [--option value ...] [--origin http://localhost:5173] [--json]
// Commands in this slice: invite-first-admin, issue-recovery-link. LOCAL only (the other commands and the
// guarded -Remote path arrive with the PowerShell wrappers in the last slice of Phase 1b-2).
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
if (flags.has('remote') || opts.has('remote')) throw new Error('Remote use is not available yet.');
const origin = opts.get('origin') ?? 'http://localhost:5173';
const now = Math.floor(Date.now() / 1000);

function show(link: string, what: string): void {
  if (flags.has('json')) console.log(JSON.stringify({ link }));
  else console.log(`${what}\n  ${link}\n  Shown once, valid for 30 minutes, works once. It is not stored anywhere else.`);
}

if (command === 'invite-first-admin') {
  const slug = slugOf(opts.get('slug'));
  const email = emailOf(opts.get('email'));
  const displayName = nameOf(opts.get('name'));
  const { token, hash } = newToken();
  const exists = runSql(`SELECT id FROM properties WHERE slug = '${slug}';`, { remote: false });
  if (exists.length === 0) throw new Error(`No property with slug ${slug} in the local database.`);
  runSql(inviteSql({ slug, email, displayName, role: 'admin', hash, now }), { remote: false });
  show(`${origin}/staff/accept#invite=${token}`, `First-admin invite for ${email} at ${slug}:`);
} else if (command === 'issue-recovery-link') {
  const email = emailOf(opts.get('email'));
  const { token, hash } = newToken();
  const found = runSql(`SELECT id FROM staff_users WHERE email = '${email.replaceAll("'", "''")}' AND disabled_at IS NULL;`, { remote: false });
  if (found.length === 0) throw new Error(`No active staff person with that email in the local database.`);
  runSql(recoverySql({ email, hash, now }), { remote: false });
  show(`${origin}/staff/accept#recover=${token}`, `Recovery link for ${email}:`);
} else {
  throw new Error(`Unknown command ${command ?? '(none)'}. Known: invite-first-admin, issue-recovery-link.`);
}
