import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emailOf, hostOf, inviteSql, languagesOf, nameOf, newToken, recoverySql, remoteRefusal, runSql, slugOf, sqlText, timezoneOf, zonesOf } from '../../scripts/operator-lib.ts';

describe('operator scripts: what they will and will not write', () => {
  it('quote text safely', () => {
    expect(sqlText("O'Brien")).toBe("'O''Brien'");
    expect(sqlText("x'); DROP TABLE staff_users; --")).toBe("'x''); DROP TABLE staff_users; --'");
  });

  it('make tokens like the Worker does: 256 random bits, 43 characters, the SHA-256 is what is stored', () => {
    const a = newToken();
    const b = newToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(createHash('sha256').update(a.token).digest('hex'));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("use the app's own rules: what the app would refuse, the script refuses", () => {
    expect(() => slugOf('Bad Slug')).toThrow();
    expect(() => slugOf('x'.repeat(41))).toThrow();
    expect(slugOf('vancouver-downtown')).toBe('vancouver-downtown');
    expect(() => emailOf('nope')).toThrow();
    expect(emailOf('  Fawzie@Example.ORG ')).toBe('fawzie@example.org');
    expect(() => nameOf('')).toThrow();
    expect(() => nameOf('x'.repeat(81))).toThrow();
    expect(() => hostOf('has spaces.example')).toThrow();
    expect(hostOf('Hico.Builderworkshop.ca')).toBe('hico.builderworkshop.ca');
  });

  it('write an invite that carries only the hash and an audit row for the system', () => {
    const { token, hash } = newToken();
    const sql = inviteSql({ slug: 'demo-whistler', email: 'a@b.test', displayName: 'Ann', role: 'admin', hash, now: 1000 });
    expect(sql).toContain(hash);
    expect(sql).not.toContain(token);
    expect(sql).toContain("'operator.invite.created'");
    expect(sql).toContain('1000');
    expect(sql).toContain(String(1000 + 30 * 60));
  });

  it('write a recovery link only for an active person, with the hash', () => {
    const { token, hash } = newToken();
    const sql = recoverySql({ email: 'a@b.test', hash, now: 5 });
    expect(sql).toContain('disabled_at IS NULL');
    expect(sql).toContain(hash);
    expect(sql).not.toContain(token);
  });

  it('the command line refuses anything remote (unattended) and unknown commands', () => {
    const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/operator.ts', ...args], { encoding: 'utf8', input: '' });
    const remote = run('invite-first-admin', '--slug', 'x', '--email', 'a@b.test', '--name', 'A', '--remote');
    expect(remote.status).not.toBe(0);
    expect(`${remote.stderr}`).toMatch(/REMOTE REQUESTED. Nothing has been run/);
    expect(run('burn-it-down').status).not.toBe(0);
    expect(run('invite-first-admin', '--slug', 'BAD SLUG', '--email', 'a@b.test', '--name', 'A').status).not.toBe(0);
  });
});

// The operator scripts run against a THROWAWAY local database (wrangler --persist-to a temp directory): nothing here
// touches the project's local state or any remote database.
const dir = mkdtempSync(join(tmpdir(), 'hico-operator-'));
const state = { remote: false, stateDir: join(dir, 'state') } as const;
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' };

function operator(...args: string[]) {
  const r = spawnSync(process.execPath, ['scripts/operator.ts', ...args, '--state-dir', state.stateDir], { encoding: 'utf8', env, input: '' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const rows = (sql: string) => runSql(sql, state);
const count = (sql: string) => Number(rows(sql)[0]?.['n']);

beforeAll(() => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state.stateDir], { encoding: 'utf8', shell: true, env });
  if (r.status !== 0) throw new Error(`migrations failed:\n${r.stdout}${r.stderr}`);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('the remote gate', () => {
  it('refuses without a slug, without a person at the keyboard, and with the wrong slug', () => {
    expect(remoteRefusal({ slug: undefined, typed: undefined, interactive: true })).toMatch(/--slug/);
    expect(remoteRefusal({ slug: 'demo', typed: 'demo', interactive: false })).toMatch(/not interactive/);
    expect(remoteRefusal({ slug: 'demo', typed: undefined, interactive: true })).toMatch(/does not match/);
    expect(remoteRefusal({ slug: 'demo', typed: 'other', interactive: true })).toMatch(/does not match/);
    expect(remoteRefusal({ slug: 'demo', typed: ' demo ', interactive: true })).toBeNull();
  });

  it('a non-interactive --remote run refuses, says what it would do, and runs nothing', () => {
    const none = operator('create-property', '--name-en', 'Remote', '--timezone', 'America/Vancouver', '--remote');
    expect(none.code).toBe(1);
    expect(none.err).toContain('REMOTE REQUESTED. Nothing has been run.');
    expect(none.err).toContain('--slug');
    const named = operator('create-property', '--name-en', 'Remote', '--timezone', 'America/Vancouver', '--slug', 'remote-test', '--remote');
    expect(named.code).toBe(1);
    expect(named.err).toMatch(/not interactive/);
    expect(named.err).toContain('insert one row into properties');
    expect(count("SELECT COUNT(*) AS n FROM properties WHERE slug = 'remote-test';")).toBe(0);
  });

  it('no script or library line can reach a remote database', () => {
    for (const f of readdirSync('scripts').filter((x) => /^operator.*\.ts$|\.ps1$/.test(x))) {
      const text = readFileSync(`scripts/${f}`, 'utf8');
      expect(text, f).not.toMatch(/d1['", ]+execute[^\n]*--remote/);
      expect(text, f).not.toMatch(/secret put|d1 create|wrangler deploy|versions upload/);
    }
    expect(readFileSync('scripts/operator-lib.ts', 'utf8')).toMatch(/'--local'/);
  });
});

describe('the validators use the app\'s own limits', () => {
  it('time zones, languages and the zones file', () => {
    expect(timezoneOf('America/Vancouver')).toBe('America/Vancouver');
    expect(() => timezoneOf('Mars/Olympus')).toThrow(/IANA/);
    expect(() => timezoneOf('x'.repeat(65))).toThrow();
    expect(languagesOf(undefined)).toBe('en,fr');
    expect(() => languagesOf('de')).toThrow();
    expect(zonesOf('[{"en":"Lobby","fr":"Hall","ring":"in_hostel"}]')).toHaveLength(1);
    expect(() => zonesOf('not json')).toThrow(/valid JSON/);
    expect(() => zonesOf('[]')).toThrow();
    expect(() => zonesOf('[{"en":"Lobby","fr":"","ring":"nearby"}]')).toThrow();
    expect(() => zonesOf('[{"en":"Lobby","fr":"","ring":"further"},{"en":"lobby","fr":"","ring":"further"}]')).toThrow(/twice/);
    expect(() => zonesOf(`[{"en":"${'x'.repeat(81)}","fr":"","ring":"further"}]`)).toThrow();
  });
});

describe('the commands, against a throwaway database', { timeout: 180_000 }, () => {
  it('create-property writes the property and one audit row, and refuses a second with the same slug', () => {
    const r = operator('create-property', '--slug', 'op-east', '--name-en', "Vancouver East", '--name-fr', 'Vancouver Est', '--timezone', 'America/Vancouver', '--address', '1 Main St');
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain('Created property op-east');
    expect(rows("SELECT name_en, name_fr, timezone, languages FROM properties WHERE slug = 'op-east';")).toEqual([
      { name_en: 'Vancouver East', name_fr: 'Vancouver Est', timezone: 'America/Vancouver', languages: 'en,fr' },
    ]);
    expect(count("SELECT COUNT(*) AS n FROM audit_log a JOIN properties p ON p.id = a.property_id WHERE p.slug = 'op-east' AND a.action = 'operator.property.created' AND a.actor_kind = 'system';")).toBe(1);
    const again = operator('create-property', '--slug', 'op-east', '--name-en', 'Again', '--timezone', 'America/Vancouver');
    expect(again.code).toBe(1);
    expect(again.err).toMatch(/already exists/);
    expect(operator('create-property', '--slug', 'Bad Slug', '--name-en', 'x', '--timezone', 'America/Vancouver').code).toBe(1);
    expect(operator('create-property', '--slug', 'op-bad-tz', '--name-en', 'x', '--timezone', 'Nowhere/Land').code).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM properties WHERE slug IN ('op-bad-tz', 'Bad Slug');")).toBe(0);
  });

  it('add-hostname adds a host, audits it, refuses a repeat, and tells you when a host is shared', () => {
    expect(operator('add-hostname', '--slug', 'op-east', '--host', 'East.Example.org', '--default').code).toBe(0);
    expect(rows("SELECT host, is_default FROM property_hosts h JOIN properties p ON p.id = h.property_id WHERE p.slug = 'op-east';")).toEqual([{ host: 'east.example.org', is_default: 1 }]);
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'operator.host.added';")).toBe(1);
    expect(operator('add-hostname', '--slug', 'op-east', '--host', 'east.example.org').err).toMatch(/already serves/);
    expect(operator('create-property', '--slug', 'op-west', '--name-en', 'West', '--timezone', 'America/Vancouver').code).toBe(0);
    const shared = operator('add-hostname', '--slug', 'op-west', '--host', 'east.example.org');
    expect(shared.code, shared.err).toBe(0);
    expect(shared.out).toMatch(/now serves 2 properties/);
    expect(operator('add-hostname', '--slug', 'op-west', '--host', 'east.example.org', '--default').code).toBe(1);
    expect(operator('add-hostname', '--slug', 'no-such', '--host', 'x.example.org').err).toMatch(/No property/);
    expect(operator('add-hostname', '--slug', 'op-east', '--host', 'bad host!').code).toBe(1);
  });

  it('load-zones loads a file, audits it, and refuses duplicates and bad files without loading anything', () => {
    const file = join(dir, 'zones.json');
    writeFileSync(file, JSON.stringify([{ en: 'Lobby', fr: 'Hall', ring: 'in_hostel' }, { en: 'Beach', fr: 'Plage', ring: 'short_walk' }]));
    const ok = operator('load-zones', '--slug', 'op-east', '--file', file);
    expect(ok.code, ok.err).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM zones z JOIN properties p ON p.id = z.property_id WHERE p.slug = 'op-east';")).toBe(2);
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'operator.zones.loaded';")).toBe(1);
    expect(operator('load-zones', '--slug', 'op-east', '--file', file).err).toMatch(/already has a zone/);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify([{ en: 'Fine', fr: '', ring: 'in_hostel' }, { en: 'Broken', fr: '', ring: 'orbit' }]));
    expect(operator('load-zones', '--slug', 'op-west', '--file', bad).code).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM zones z JOIN properties p ON p.id = z.property_id WHERE p.slug = 'op-west';")).toBe(0); // all or nothing
  });

  it('invite-first-admin and issue-recovery-link print a link once and store only its hash', () => {
    const invite = operator('invite-first-admin', '--slug', 'op-east', '--email', 'Boss@Example.org', '--name', 'Bo Boss', '--origin', 'http://localhost:4173', '--json');
    expect(invite.code, invite.err).toBe(0);
    const link = (JSON.parse(invite.out.split('\n').find((l) => l.startsWith('{')) ?? '{}') as { link: string }).link;
    const token = link.split('#invite=')[1] as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = rows("SELECT token_hash, purpose, role, email FROM staff_tokens WHERE purpose = 'invite';");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.['token_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows('SELECT token_hash, email, display_name FROM staff_tokens;') + JSON.stringify(rows('SELECT id, action, target_type, target_id FROM audit_log;')))).not.toContain(token);
    expect(operator('invite-first-admin', '--slug', 'no-such', '--email', 'a@b.org', '--name', 'A').err).toMatch(/No property/);
    // Recovery needs an existing person.
    expect(operator('issue-recovery-link', '--email', 'nobody@example.org').err).toMatch(/No active staff person/);
    const now = Math.floor(Date.now() / 1000);
    rows(`INSERT INTO staff_users (id, email, display_name, created_at) VALUES ('${'a'.repeat(32)}', 'boss@example.org', 'Bo Boss', ${now});
      INSERT INTO staff_memberships (staff_user_id, property_id, role) SELECT '${'a'.repeat(32)}', id, 'admin' FROM properties WHERE slug = 'op-east';`);
    const rec = operator('issue-recovery-link', '--email', 'boss@example.org', '--json');
    expect(rec.code, rec.err).toBe(0);
    expect(rec.out).toContain('#recover=');
    expect(count("SELECT COUNT(*) AS n FROM staff_tokens WHERE purpose = 'recovery';")).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'operator.recovery.issued';")).toBe(1);
  });

  it('an unknown command lists the known ones', () => {
    const r = operator('drop-everything');
    expect(r.code).toBe(1);
    expect(r.err).toContain('create-property, add-hostname, invite-first-admin, load-zones, issue-recovery-link');
  });
});

describe('the PowerShell wrappers', () => {
  const pwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
  const have = pwsh.status === 0;
  const run = (script: string, ...args: string[]) => spawnSync('pwsh', ['-NoProfile', '-File', join('scripts', script), ...args, '-StateDir', state.stateDir], { encoding: 'utf8', env, input: '' });

  it.skipIf(!have)('create-property.ps1 and add-hostname.ps1 reach the same commands', () => {
    const a = run('create-property.ps1', '-Slug', 'ps-north', '-NameEn', 'North', '-Timezone', 'America/Toronto');
    expect(a.status, a.stderr).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM properties WHERE slug = 'ps-north' AND timezone = 'America/Toronto';")).toBe(1);
    const b = run('add-hostname.ps1', '-Slug', 'ps-north', '-HostName', 'north.example.org');
    expect(b.status, b.stderr).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM property_hosts WHERE host = 'north.example.org';")).toBe(1);
  }, 120_000);

  it.skipIf(!have)('-Remote from a script refuses when not interactive, and nothing is written', () => {
    const r = run('create-property.ps1', '-Slug', 'ps-remote', '-NameEn', 'Remote', '-Timezone', 'America/Toronto', '-Remote');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('REMOTE REQUESTED');
    expect(count("SELECT COUNT(*) AS n FROM properties WHERE slug = 'ps-remote';")).toBe(0);
  }, 120_000);

  it('all five wrappers exist and share one entry point', () => {
    for (const s of ['create-property', 'add-hostname', 'invite-first-admin', 'load-zones', 'issue-recovery-link']) {
      const text = readFileSync(`scripts/${s}.ps1`, 'utf8');
      expect(text, s).toContain(`Invoke-Operator -Command '${s}'`);
      expect(text, s).toContain('[switch]$Remote');
    }
  });
});
