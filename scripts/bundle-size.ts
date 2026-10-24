import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// 04 §7: initial JavaScript for the guest app at most 60 KB gzip. Measures what index.html loads.
const BUDGET = 60 * 1024;
const dir = 'dist/client';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1] as string);
const rows = [...new Set(refs)].map((ref) => {
  const raw = readFileSync(join(dir, ref));
  return { ref, raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length };
});
for (const r of rows) console.log(`${r.ref.padEnd(40)} raw ${String(r.raw).padStart(7)}  gzip ${String(r.gzip).padStart(6)}`);
const js = rows.filter((r) => r.ref.endsWith('.js')).reduce((n, r) => n + r.gzip, 0);
const css = rows.filter((r) => r.ref.endsWith('.css')).reduce((n, r) => n + r.gzip, 0);
console.log(`initial JavaScript ${js} bytes gzip (budget ${BUDGET}), stylesheets ${css} bytes gzip`);
if (rows.filter((r) => r.ref.endsWith('.js')).length === 0) {
  console.log('FAIL: no script found in dist/client/index.html');
  process.exit(1);
}
if (js > BUDGET) {
  console.log('FAIL: over the budget');
  process.exit(1);
}
console.log('within budget');
