import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSeedSql } from './data.ts';
import { assertLocalOnly } from './guard.ts';

// Seeds the LOCAL D1 database only. It never builds a remote command; assertLocalOnly refuses
// any argument that could point elsewhere. Wrangler metrics are switched off for this run.
assertLocalOnly(process.argv.slice(2), process.env);

mkdirSync('.wrangler', { recursive: true });
const file = '.wrangler/seed.sql';
writeFileSync(file, buildSeedSql(Math.floor(Date.now() / 1000)));

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' };
const run = (args: string[]) => {
  const r = spawnSync('npx', ['wrangler', ...args], { encoding: 'utf8', shell: true, env });
  const out = `${r.stdout}${r.stderr}`;
  if (r.status !== 0) {
    console.error(out);
    process.exit(r.status ?? 1);
  }
  // Keep the log short: the one-line outcome, not the per-statement JSON.
  for (const line of out.split('\n')) {
    if (/No migrations to apply|migrations? (were )?applied|commands executed|Resource location/i.test(line)) console.log(`wrangler: ${line.trim()}`);
  }
};
run(['d1', 'migrations', 'apply', 'DB', '--local']);
run(['d1', 'execute', 'DB', '--local', '--file', file]);
console.log('Seeded local D1 (demo-whistler, vancouver-downtown, vancouver-jericho-beach).');
