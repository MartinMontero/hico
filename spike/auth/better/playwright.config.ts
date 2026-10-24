import { mkdirSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// SPIKE Route 2: Better Auth on workerd with local D1. 8790 right origin, 8791 wrong origin.
mkdirSync('../logs', { recursive: true });
const common = '-c wrangler.jsonc --local --persist-to ../.state-better --var RP_ID:localhost --var SESSION_PEPPER:spike-test-pepper-not-a-secret-0123456789 --var SPIKE_TEST:on';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8790' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `node prepare-db.ts && npx wrangler dev ${common} --port 8790 --inspector-port 9233 --var ORIGIN:http://localhost:8790 > ../logs/better-8790.log 2>&1`,
      url: 'http://localhost:8790/',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
    },
    {
      command: `npx wrangler dev ${common} --port 8791 --inspector-port 9234 --var ORIGIN:http://localhost:9999 > ../logs/better-8791.log 2>&1`,
      url: 'http://localhost:8791/',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
    },
  ],
});
