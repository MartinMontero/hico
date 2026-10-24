import { spawnSync } from 'node:child_process';

// Applies migrations and seeds the LOCAL database (seed/run.ts refuses anything else), then issues the
// first-admin invite for the demo properties the way the operator would: through scripts/operator.ts.
export default function globalSetup(): void {
  const seeded = spawnSync(process.execPath, ['seed/run.ts', '--local'], { stdio: 'inherit' });
  if (seeded.status !== 0) throw new Error('Seeding the local database failed');

  const invite = (slug: string, email: string, name: string): string => {
    const r = spawnSync(process.execPath, ['scripts/operator.ts', 'invite-first-admin', '--slug', slug, '--email', email, '--name', name, '--origin', 'http://localhost:4173', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    if (r.status !== 0) throw new Error(`invite-first-admin failed: ${r.stderr}`);
    const line = r.stdout.split('\n').find((l) => l.startsWith('{')) ?? '';
    return (JSON.parse(line) as { link: string }).link;
  };
  // Workers started after global setup inherit these. The links are single use and expire in 30 minutes.
  process.env['E2E_WHISTLER_ADMIN_LINK'] = invite('demo-whistler', 'admin@whistler.e2e.test', 'Whistler Admin');
  process.env['E2E_DOWNTOWN_ADMIN_LINK'] = invite('vancouver-downtown', 'fawzie@e2e.test', 'Fawzie Both');
}
