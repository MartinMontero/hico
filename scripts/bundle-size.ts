import { readdirSync, readFileSync } from 'node:fs';
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
// The staff console is a separate chunk that guests never load; it has its own budget (plan §4).
const STAFF_BUDGET = 90 * 1024;
const chunks = readdirSync(join(dir, 'assets')).filter((f) => /^Staff.*\.js$/.test(f));
let staff = 0;
for (const f of chunks) {
  const raw = readFileSync(join(dir, 'assets', f));
  const gz = gzipSync(raw, { level: 9 }).length;
  staff += gz;
  console.log(`${`/assets/${f}`.padEnd(40)} raw ${String(raw.length).padStart(7)}  gzip ${String(gz).padStart(6)}  (staff chunk, loaded only on /staff)`);
}
console.log(`staff chunk(s) ${staff} bytes gzip (budget ${STAFF_BUDGET})`);
if (chunks.length === 0 || staff > STAFF_BUDGET) {
  console.log(chunks.length === 0 ? 'FAIL: no staff chunk was built' : 'FAIL: staff chunk over its budget');
  process.exit(1);
}
console.log('within budget');
