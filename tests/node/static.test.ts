/* eslint-disable no-restricted-syntax -- the detector fixtures contain the forbidden text on purpose */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNames, collectConfigNames, FORBIDDEN_WORKER_NAMES, resolvedNames } from '../../scripts/names.ts';

// Static rules (brief items 1 and 4): raw database access only in worker/repositories, no
// SELECT * anywhere, tenant contexts built only by the middleware, no third-party hosts.

const ROOT = process.cwd();

function files(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // spike/ is throwaway research code (Phase 1b-1): raw SQL, test routes. It is excluded from these
    // scans and never imported by shipped code; the "spike stays outside" test below enforces that.
    if (['node_modules', 'dist', '.wrangler', 'reference', 'docs', '.git', 'test-results', 'playwright-report', 'spike'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
const rel = (f: string) => relative(ROOT, f).replaceAll('\\', '/');

// --- the detectors, tested on their own below so a broken regex cannot pass silently ---
// exec is flagged only on a database-looking receiver: RegExp.prototype.exec is everywhere.
export const RAW_DB = /\.(prepare|batch|dump)\(|\b(?:db|DB|database)\s*\.exec\(/;
export const SELECT_STAR = /select\s+(distinct\s+)?(\w+\.)?\*/i;
export const TENANT_FACTORY = /createTenantContext/;

describe('the detectors detect', () => {
  it('RAW_DB', () => {
    expect(RAW_DB.test('await env.DB.prepare("x")')).toBe(true);
    expect(RAW_DB.test('db.batch([a])')).toBe(true);
    expect(RAW_DB.test('env.DB.exec("x")')).toBe(true);
    expect(RAW_DB.test('const prepared = 1')).toBe(false);
    expect(RAW_DB.test('const m = /x/.exec(text)')).toBe(false);
  });
  it('SELECT_STAR', () => {
    expect(SELECT_STAR.test('SELECT * FROM t')).toBe(true);
    expect(SELECT_STAR.test('select\n  * from t')).toBe(true);
    expect(SELECT_STAR.test('SELECT a.* FROM t a')).toBe(true);
    expect(SELECT_STAR.test('SELECT COUNT(*) AS n FROM t')).toBe(false);
    expect(SELECT_STAR.test('SELECT id, name FROM t')).toBe(false);
  });
});

describe('database access', () => {
  const source = files(ROOT, ['.ts', '.tsx', '.sql', '.js', '.mjs']).filter((f) => !rel(f).startsWith('tests/node/static.test.ts'));

  it('no SELECT * in any source or migration file', () => {
    const hits = source.filter((f) => SELECT_STAR.test(readFileSync(f, 'utf8'))).map(rel);
    expect(hits).toEqual([]);
  });

  it('prepare, batch, exec and dump are used only in worker/repositories, seed and tests', () => {
    const allowed = (f: string) => f.startsWith('worker/repositories/') || f.startsWith('seed/') || f.startsWith('tests/');
    const hits = source
      .map(rel)
      .filter((f) => !allowed(f))
      .filter((f) => RAW_DB.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the D1 binding is handed to repositories by exactly the files that must, and nowhere else', () => {
    const mayTouchBinding = new Set([
      'worker/app.ts', 'worker/middleware/tenant.ts', 'worker/middleware/guards.ts', 'worker/middleware/staff-session.ts',
      'worker/tenant.ts', 'worker/ratelimit.ts', 'worker/routes/staff-auth.ts', 'worker/routes/staff-people.ts',
      'worker/routes/staff-content.ts', 'worker/routes/staff-export.ts', 'worker/repositories/index.ts',
    ]);
    const hits = source
      .map(rel)
      .filter((f) => f.startsWith('worker/') && !f.startsWith('worker/repositories/') && !mayTouchBinding.has(f))
      .filter((f) => /\benv\.DB\b|\.env\.DB\b|\bD1Database\b/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('web code never reaches the database or the Worker internals', () => {
    const hits = source
      .map(rel)
      .filter((f) => f.startsWith('web/'))
      .filter((f) => /from ['"].*worker\//.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the tenant context is built only by the middleware, the tenant module and tests', () => {
    const allowed = new Set(['worker/tenant.ts', 'worker/middleware/tenant.ts']);
    const hits = source
      .map(rel)
      .filter((f) => !allowed.has(f) && !f.startsWith('tests/'))
      .filter((f) => TENANT_FACTORY.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('every repository function takes the tenant context first, or the database (a documented lookup or person-level function)', () => {
    // Property data: ctx only. Person-level modules (sessions, credentials, tokens, challenges, rate limits,
    // host and staff lookups, the platform flag) take the database. audit and people have both kinds.
    const ctxOnly = new Set(['activities.ts', 'places.ts', 'offers.ts', 'properties.ts', 'events.ts', 'zones.ts', 'codes.ts', 'features.ts', 'content-export.ts']);
    const dbOnly = new Set(['hosts.ts', 'flags.ts', 'staff.ts', 'sessions.ts', 'credentials.ts', 'tokens.ts', 'challenges.ts', 'ratelimit.ts']);
    for (const f of readdirSync('worker/repositories').filter((x) => x.endsWith('.ts') && x !== 'index.ts')) {
      const text = readFileSync(`worker/repositories/${f}`, 'utf8');
      for (const m of text.matchAll(/export async function (\w+)\(\s*(\w+)/g)) {
        const where = `${f}:${m[1]}`;
        if (ctxOnly.has(f)) expect(m[2], where).toBe('ctx');
        else if (dbOnly.has(f)) expect(m[2], where).toBe('db');
        else expect(['ctx', 'db'], where).toContain(m[2]);
      }
    }
  });
  it('every SQL statement in a tenant repository mentions property_id or the offered-at join', () => {
    for (const f of ['activities.ts', 'places.ts', 'offers.ts', 'audit.ts', 'events.ts', 'properties.ts', 'zones.ts', 'codes.ts', 'features.ts']) {
      const text = readFileSync(`worker/repositories/${f}`, 'utf8');
      for (const m of text.matchAll(/\.prepare\(\s*`([\s\S]*?)`/g)) {
        // ${VISIBLE} expands to the offered-at join, which carries o.property_id = ?3.
        expect(m[1], `${f}: ${(m[1] ?? '').slice(0, 60)}`).toMatch(/property_id|\bp\.id = \?1|\$\{VISIBLE\}/);
      }
    }
  });
});

describe('spike code stays outside', () => {
  it('nothing in worker, web, shared, seed or scripts imports from spike/', () => {
    const shipped = ['worker', 'web', 'shared', 'seed', 'scripts'].flatMap((d) => files(join(ROOT, d), ['.ts', '.tsx', '.js', '.mjs', '.css', '.html']));
    const hits = shipped.filter((f) => /(from|import)\s*\(?\s*['"][^'"]*\bspike\//.test(readFileSync(f, 'utf8'))).map(rel);
    expect(hits).toEqual([]);
  });

  it('the repository root package.json does not depend on any spike package', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    // SimpleWebAuthn is not listed: D-26 adopted it for the real build. The routes that were not chosen stay out.
    for (const spikeOnly of ['better-auth', '@better-auth/passkey', 'jose', 'kysely-d1']) {
      expect(names, spikeOnly).not.toContain(spikeOnly);
    }
  });
});

describe('Worker names', () => {
  it('the source and any built configuration resolve to hico-preview and hico-prod only', () => {
    for (const { file, names } of collectConfigNames(ROOT)) {
      expect(checkNames(names), file).toEqual([]);
    }
    const src = collectConfigNames(ROOT)[0];
    expect(src?.names.sort()).toEqual(['hico-preview', 'hico-prod']);
  });

  it('the check really fails for each live app name', () => {
    for (const bad of FORBIDDEN_WORKER_NAMES) {
      expect(checkNames(resolvedNames({ name: 'hico-preview', env: { prod: { name: bad } } })).length, bad).toBe(1);
      expect(checkNames(resolvedNames({ name: bad })).length, bad).toBe(1);
    }
    expect(checkNames(['hico-preview', 'hico-prod'])).toEqual([]);
  });
});

describe('no third-party hosts or scripts', () => {
  it('web sources, the HTML and the stylesheets name no external host', () => {
    const own = [...files(join(ROOT, 'web'), ['.ts', '.tsx', '.css']), join(ROOT, 'index.html')];
    const offenders = own.filter((f) => /https?:\/\/(?!localhost|www\.w3\.org\/)/i.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('fonts are self-hosted with their licence', () => {
    const fonts = readdirSync(join(ROOT, 'public', 'fonts'));
    expect(fonts.filter((f) => f.endsWith('.woff2')).length).toBeGreaterThanOrEqual(3);
    expect(fonts).toContain('DM-Sans-OFL-LICENSE.txt');
    expect(readFileSync(join(ROOT, 'public', 'fonts', 'DM-Sans-OFL-LICENSE.txt'), 'utf8')).toContain('SIL Open Font License');
    const css = readFileSync(join(ROOT, 'web/src/styles/fonts.css'), 'utf8');
    expect(css).not.toMatch(/googleapis|gstatic/);
  });

  it('the guest entry bundle does not carry the staff console or the passkey library', () => {
    const index = join(ROOT, 'dist', 'client', 'index.html');
    try {
      statSync(index);
    } catch {
      return; // not built yet
    }
    const html = readFileSync(index, 'utf8');
    const entry = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1] as string);
    expect(entry.length).toBeGreaterThan(0);
    for (const ref of entry) {
      const code = readFileSync(join(ROOT, 'dist', 'client', ref), 'utf8');
      expect(code, ref).not.toMatch(/navigator\.credentials|PublicKeyCredential|startRegistration|startAuthentication/);
      expect(code, ref).not.toContain('/api/staff/');
    }
  });

  it('a built client, when present, contains no external host and no beacon string', () => {
    const dist = join(ROOT, 'dist', 'client');
    try {
      statSync(dist);
    } catch {
      return; // not built yet; scripts/validate.ts builds first and runs this file again
    }
    const built = files(dist, ['.html', '.js', '.css']);
    expect(built.length).toBeGreaterThan(0);
    for (const f of built) {
      const text = readFileSync(f, 'utf8');
      expect(text, rel(f)).not.toMatch(/googleapis|gstatic|cloudflareinsights|google-analytics|googletagmanager/i);
      // Allowed: the W3C namespace strings frameworks embed, and simplewebauthn.dev, which appears only inside an error
      // message of the passkey library (a documentation link in text; no request is made, and the browser tests fail on any external request).
      const hosts = [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]).filter((h) => !/^(www\.w3\.org|localhost|simplewebauthn\.dev)$/.test(h ?? ''));
      expect(hosts, rel(f)).toEqual([]);
    }
  });
});
