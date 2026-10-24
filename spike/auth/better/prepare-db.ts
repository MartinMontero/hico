import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

// Builds a fresh LOCAL D1 for the spike: the repository's migrations, then the spike tables.
// Only ever `--local`, with its own persist directory under spike/auth/.state.
const root = '../../..';
const state = '../.state-better';
rmSync(state, { recursive: true, force: true });
mkdirSync(state, { recursive: true });
const migrations = readdirSync(`${root}/migrations`).filter((f) => f.endsWith('.sql')).sort();
const sql = [...migrations.map((f) => readFileSync(`${root}/migrations/${f}`, 'utf8')), readFileSync('schema.sql', 'utf8')].join('\n');
writeFileSync(`${state}/combined.sql`, sql);
const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'DB', '-c', 'wrangler.jsonc', '--local', '--persist-to', state, '--file', `${state}/combined.sql`], {
  encoding: 'utf8',
  shell: true,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
});
const out = `${r.stdout}${r.stderr}`;
console.log(out.split('\n').filter((l) => /commands executed|error|Error/i.test(l)).join('\n'));
process.exit(r.status ?? 1);
