import { mkdirSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// SPIKE: two local wrangler dev servers on one local D1. 8788 has the right origin; 8789 is told a
// different origin, to prove the origin check. Test-only values are made up and live only here.
mkdirSync('../logs', { recursive: true });
const common = '-c wrangler.jsonc --local --persist-to ../.state --var RP_ID:localhost --var SESSION_PEPPER:spike-test-pepper-not-a-secret-0123456789 --var SPIKE_TEST:on';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8788' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `node prepare-db.ts && node build-client.ts && npx wrangler dev ${common} --port 8788 --inspector-port 9231 --var ORIGIN:http://localhost:8788 > ../logs/own-8788.log 2>&1`,
      url: 'http://localhost:8788/',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
    },
    {
      command: `npx wrangler dev ${common} --port 8789 --inspector-port 9232 --var ORIGIN:http://localhost:9999 > ../logs/own-8789.log 2>&1`,
      url: 'http://localhost:8789/',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
    },
  ],
});
