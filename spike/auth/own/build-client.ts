import { spawnSync } from 'node:child_process';

// Bundles the client (with the real @simplewebauthn/browser) into public/client.js using the esbuild
// that ships with the repository's tooling.
const r = spawnSync('npx', ['esbuild', 'client/main.ts', '--bundle', '--format=esm', '--minify', '--outfile=public/client.js'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
