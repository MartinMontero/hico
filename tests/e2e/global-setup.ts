import { spawnSync } from 'node:child_process';

// Applies migrations and seeds the LOCAL database (seed/run.ts refuses anything else).
export default function globalSetup(): void {
  const r = spawnSync(process.execPath, ['seed/run.ts', '--local'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Seeding the local database failed');
}
