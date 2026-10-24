import { spawnSync } from 'node:child_process';

// Three TypeScript projects: Worker (workers types), web (DOM), node (scripts and tests).
let failed = false;
for (const project of ['tsconfig.worker.json', 'tsconfig.web.json', 'tsconfig.node.json']) {
  console.log(`> tsc -p ${project}`);
  const r = spawnSync('npx', ['tsc', '-p', project], { stdio: 'inherit', shell: true });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
