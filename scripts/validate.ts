import { spawnSync } from 'node:child_process';

// npm run validate: typecheck, lint, all tests, contrast table, build, post-build checks, then the
// browser tests (axe-core at 360 px and a keyboard walk). Any failure makes the exit code 1.
interface Step {
  name: string;
  cmd: string;
  args: string[];
  needs?: string;
}

const steps: Step[] = [
  { name: 'typecheck', cmd: 'node', args: ['scripts/typecheck.ts'] },
  { name: 'lint', cmd: 'node', args: ['scripts/lint.ts'] },
  { name: 'unit and isolation tests', cmd: 'npx', args: ['vitest', 'run'] },
  { name: 'contrast table', cmd: 'node', args: ['scripts/contrast.ts'] },
  { name: 'build', cmd: 'npm', args: ['run', 'build'] },
  { name: 'worker names', cmd: 'node', args: ['scripts/check-names.ts'], needs: 'build' },
  { name: 'bundle size', cmd: 'node', args: ['scripts/bundle-size.ts'], needs: 'build' },
  { name: 'built output checks', cmd: 'npx', args: ['vitest', 'run', 'tests/node/static.test.ts'], needs: 'build' },
  { name: 'browser tests (axe, 360 px, keyboard)', cmd: 'npx', args: ['playwright', 'test'], needs: 'build' },
  { name: 'lighthouse mobile (LCP, TBT, CLS printed)', cmd: 'node', args: ['scripts/lighthouse.ts'], needs: 'build' },
];

const results = new Map<string, boolean>();
for (const step of steps) {
  console.log(`\n===== ${step.name} =====`);
  if (step.needs && results.get(step.needs) === false) {
    console.log(`skipped: ${step.needs} failed`);
    results.set(step.name, false);
    continue;
  }
  const r = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: true, env: { ...process.env, FORCE_COLOR: '0', WRANGLER_SEND_METRICS: 'false' } });
  results.set(step.name, r.status === 0);
}

console.log('\n===== summary =====');
let failed = false;
for (const [name, ok] of results) {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}
console.log(failed ? '\nvalidate FAILED' : '\nvalidate passed');
process.exit(failed ? 1 : 0);
