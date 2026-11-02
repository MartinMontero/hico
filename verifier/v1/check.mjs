import { existsSync, readFileSync } from 'node:fs';

const required = [
  'docs/plans/2026-11-02-kimi-mvp-preview.md',
  'docs/content-templates/activities.json',
  'docs/content-templates/places.json',
  'docs/content-templates/offers.json',
  'docs/content-templates/zones.json',
  'shared/import-schemas.ts',
  'worker/routes/staff-import.ts',
  'scripts/launch-check.ps1',
  'scripts/verify-deploy.ps1',
  'tests/worker/staff-import.test.ts',
  'docs/goose/MVP-HANDOFF.md',
  'docs/spikes/kimi-mvp-preview-evidence.md',
];

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

for (const path of required) check(existsSync(path), `exists ${path}`);

for (const name of ['activities', 'places', 'offers', 'zones']) {
  const path = `docs/content-templates/${name}.json`;
  if (!existsSync(path)) continue;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    const text = JSON.stringify(value);
    check(value.format === `hico-${name}-v1`, `${name} template format`);
    check(Array.isArray(value.items) && value.items.length > 0, `${name} template has an item`);
    check(text.includes('REPLACE_WITH_PROPERTY_CONTENT'), `${name} template cannot masquerade as real content`);
  } catch (error) {
    check(false, `${name} template parses`, error.message);
  }
}

if (existsSync('wrangler.jsonc')) {
  const config = readFileSync('wrangler.jsonc', 'utf8');
  check(config.includes('"name": "hico-preview"'), 'preview Worker name');
  check(config.includes('"name": "hico-prod"'), 'production Worker remains separately configured');
  for (const forbidden of ['"name": "hico"', '"name": "mec-trails"', '"name": "lume"', '"name": "lume-city"']) {
    check(!config.includes(forbidden), `forbidden Worker name absent ${forbidden}`);
  }
}

if (existsSync('docs/goose/MVP-HANDOFF.md')) {
  const handoff = readFileSync('docs/goose/MVP-HANDOFF.md', 'utf8');
  for (const phrase of ['This is a Goose Desktop prompt', 'PowerShell', 'Done when', 'Stop and ask']) {
    check(handoff.includes(phrase), `Goose handoff contains ${phrase}`);
  }
  check(!handoff.includes(' && '), 'Goose handoff has no bash && chaining');
}

console.log(`\n${failures === 0 ? 'verifier passed' : `verifier FAILED: ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
