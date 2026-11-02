import { existsSync, readFileSync } from 'node:fs';

const required = [
  'docs/plans/2026-11-02-kimi-mvp-preview.md',
  'docs/content-templates/activities.json',
  'docs/content-templates/places.json',
  'docs/content-templates/offers.json',
  'docs/content-templates/zones.json',
  'shared/import-schemas.ts',
  'shared/content-health.ts',
  'worker/routes/staff-import.ts',
  'worker/routes/staff-export.ts',
  'web/src/staff/ContentHealth.tsx',
  'scripts/launch-check.ps1',
  'scripts/verify-deploy.ps1',
  'tests/worker/isolation-staff-import.test.ts',
  'tests/worker/isolation-staff-counts.test.ts',
  'tests/worker/staff-content-health.test.ts',
  'docs/goose/MVP-HANDOFF.md',
  'docs/spikes/kimi-mvp-preview-evidence.md',
  'docs/spikes/kimi-mvp-preview-validate.txt',
  'docs/spikes/kimi-mvp-preview-offline-validate.txt',
  'docs/spikes/kimi-mvp-preview-dependencies.md',
  'docs/spikes/kimi-mvp-preview-security-review.md',
  'docs/spikes/kimi-mvp-preview-architecture.md',
  'worker/preview-gate/index.ts',
  'web/sw/logic.ts',
  'tests/worker/gate.test.ts',
  'tests/web/sw.test.ts',
  'verifier/runs/2026-11-02T19-31-56Z-v2-remote-pass.md',
];

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';

for (const path of required) check(existsSync(path), `exists ${path}`);
for (const path of ['tests/worker/staff-import.test.ts', 'tests/worker/staff-counts.test.ts']) {
  check(!existsSync(path), `superseded test absent ${path}`);
}

for (const name of ['activities', 'places', 'offers', 'zones']) {
  const path = `docs/content-templates/${name}.json`;
  if (!existsSync(path)) continue;
  try {
    const value = JSON.parse(read(path));
    const text = JSON.stringify(value);
    check(value.format === `hico-${name}-v1`, `${name} template format`);
    check(Array.isArray(value.items) && value.items.length > 0, `${name} template has an item`);
    check(text.includes('REPLACE_WITH_PROPERTY_CONTENT'), `${name} template cannot masquerade as real content`);
  } catch (error) {
    check(false, `${name} template parses`, error.message);
  }
}

const config = read('wrangler.jsonc');
check(config.includes('"name": "hico-preview"'), 'preview Worker name');
check(config.includes('"name": "hico-prod"'), 'production Worker remains separately configured');
for (const forbidden of ['"name": "hico"', '"name": "mec-trails"', '"name": "lume"', '"name": "lume-city"']) {
  check(!config.includes(forbidden), `forbidden Worker name absent ${forbidden}`);
}

const handoff = read('docs/goose/MVP-HANDOFF.md');
for (const phrase of ['This is a Goose Desktop prompt', 'PowerShell', 'Done when', 'Stop and ask']) {
  check(handoff.includes(phrase), `Goose handoff contains ${phrase}`);
}
check((handoff.match(/This is a Goose Desktop prompt/g) ?? []).length === 7, 'seven complete Goose prompts');
check(!handoff.includes(' && '), 'Goose handoff has no bash && chaining');

const oldOutput = read('docs/spikes/kimi-mvp-preview-validate.txt');
check(oldOutput.includes('validate passed'), 'earlier raw complete validation passed');
check(oldOutput.includes('587 passed') && oldOutput.includes('2 skipped'), 'earlier raw unit/isolation totals');
check(oldOutput.includes('43 passed'), 'earlier raw browser total');
check(oldOutput.includes('LCP 2057 ms') && oldOutput.includes('LCP 2147 ms'), 'earlier raw Lighthouse values');

const output = read('docs/spikes/kimi-mvp-preview-offline-validate.txt');
check(output.includes('validate passed'), 'preview/offline raw complete validation passed');
check(output.includes('39 passed') && output.includes('587 passed') && output.includes('2 skipped'), 'preview/offline raw unit/isolation totals');
check(output.includes('43 passed'), 'preview/offline raw browser total');
check((output.match(/LCP \d+ ms/g) ?? []).length >= 2, 'preview/offline raw Lighthouse values for both guest routes');
check(output.includes('TBT') && output.includes('CLS'), 'preview/offline raw Lighthouse includes TBT and CLS');

const gate = read('worker/preview-gate/index.ts');
check(gate.includes("const upstreamCache = c.res.headers.get('Cache-Control') ?? '';"), 'gate captures upstream cache policy');
check(gate.indexOf('c.res = new Response(c.res.body, c.res);') < gate.indexOf("c.res.headers.set('Cache-Control'"), 'gate sets final cache policy after Hono response assignment');
check(gate.includes("/\\bno-store\\b/i.test(upstreamCache) ? 'private, no-store' : 'private, no-cache'"), 'gate preserves no-store and permits origin-private guest storage');
check(!gate.includes('DEBUG_GATE') && !gate.includes('DEBUG_AFTER'), 'temporary gate debugging absent');

const sw = read('web/sw/logic.ts');
check(sw.includes("/\\bno-store\\b/i.test(res.headers.get('Cache-Control') ?? '')"), 'service-worker predicate excludes no-store');
check(sw.includes("res.ok && res.type !== 'opaque' && res.type !== 'error'"), 'service-worker predicate retains success and response-type guards');
check(!sw.includes("includes('private')"), 'service-worker does not reject private merely because it is private');

const gateTest = read('tests/worker/gate.test.ts');
check(gateTest.includes("import { cacheable } from '../../web/sw/logic.ts';"), 'gate regression uses the real service-worker predicate');
check(gateTest.includes("expect(page.headers.get('Cache-Control')).toBe('private, no-cache');"), 'guest gate regression expects private no-cache');
check(gateTest.includes("expect(staff.headers.get('Cache-Control')).toBe('private, no-store');"), 'staff gate regression preserves no-store');
check(gateTest.includes('expect(cacheable(page)).toBe(true);') && gateTest.includes('expect(cacheable(staff)).toBe(false);'), 'cross-layer cacheability assertions exist');

const swTest = read('tests/web/sw.test.ts');
check(swTest.includes("expect(cacheable(res({ 'Cache-Control': 'private, no-cache' }))).toBe(true);"), 'service-worker test accepts private no-cache');
check(swTest.includes("expect(cacheable(res({ 'Cache-Control': 'private, no-store' }))).toBe(false);"), 'service-worker test rejects private no-store');

const security = read('docs/spikes/kimi-mvp-preview-security-review.md');
for (const category of ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']) {
  check(security.includes(`## ${category}`), `security review covers ${category}`);
}
check(security.includes('not** an independent human security review'), 'security review discloses same-model limitation');
check(security.includes('last-admin and last-passkey races') && security.includes('account recovery is not one atomic operation'), 'open account integrity findings retained');
check(security.includes('content write and audit can diverge'), 'open audit atomicity finding retained');

const dependencies = read('docs/spikes/kimi-mvp-preview-dependencies.md');
check(dependencies.includes('16 vulnerable package entries') && dependencies.includes('10 distinct GHSA'), 'dependency entry and advisory counts recorded');
check(dependencies.includes('GHSA-g3hv-75wg-m249') && dependencies.includes('GHSA-mrhx-c7xc-m3w5'), 'minimatch and zod advisories recorded');
check((dependencies.match(/GHSA-/g) ?? []).length >= 10, 'all direct advisory identifiers retained');
check(dependencies.includes('Do **not** run `npm audit fix --force`'), 'automatic dependency force-fix refused');

const evidence = read('docs/spikes/kimi-mvp-preview-evidence.md');
check(evidence.includes('41509225065') && evidence.includes('2fa16f222bbeeca26085f39b23a4e00c9ce85383'), 'old exact-head CI evidence retained');
check(evidence.includes('No Cloudflare resource was created or changed'), 'Cloudflare no-write boundary retained');

for (const path of ['.dev.vars', '.env', '.env.production', '.env.preview']) {
  check(!existsSync(path), `secret-bearing local file absent ${path}`);
}

console.log(`\n${failures === 0 ? 'verifier passed' : `verifier FAILED: ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
