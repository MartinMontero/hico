import { writeFileSync } from 'node:fs';
import { COLORS, MIN_RATIO, PAIRS, tokensCss } from '../shared/tokens.ts';
import { contrast } from '../shared/contrast.ts';

// Prints every text/background pair with its ratio and exits 1 if any is under its minimum.
if (process.argv.includes('--write-css')) {
  writeFileSync(new URL('../web/src/styles/tokens.css', import.meta.url), tokensCss());
  console.log('wrote web/src/styles/tokens.css');
}

const rows = PAIRS.map((p) => {
  const ratio = contrast(COLORS[p.text], COLORS[p.background]);
  const min = MIN_RATIO[p.kind];
  return { p, ratio, min, ok: ratio >= min };
});

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`${pad('text', 9)} ${pad('on', 8)} ${pad('kind', 7)} ${pad('ratio', 7)} ${pad('min', 4)} result  use`);
for (const r of rows) {
  console.log(
    `${pad(r.p.text, 9)} ${pad(r.p.background, 8)} ${pad(r.p.kind, 7)} ${pad(r.ratio.toFixed(2), 7)} ${pad(String(r.min), 4)} ${r.ok ? 'pass  ' : 'FAIL  '}  ${r.p.use}`,
  );
}
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length} pairs, ${failed.length} below minimum`);
process.exit(failed.length === 0 ? 0 : 1);
