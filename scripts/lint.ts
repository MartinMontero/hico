import { spawnSync } from 'node:child_process';

// oxlint carries the jsx-a11y rules (the ESLint plugin does not support ESLint 10, 05 §2.1);
// ESLint carries the data-access and no-any rules. Both must pass.
const steps: [string, string[]][] = [
  ['oxlint', ['oxlint', '--jsx-a11y-plugin', 'web', 'worker', 'shared', 'scripts', 'tests', 'seed']],
  ['eslint', ['eslint', '.']],
];
let failed = false;
for (const [name, args] of steps) {
  console.log(`> ${name}`);
  const r = spawnSync('npx', args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
