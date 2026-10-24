import { defineConfig } from '@playwright/test';

// Serves the BUILT app (vite build first) with the Cloudflare plugin's local runtime and the
// local D1 state seeded by tests/e2e/global-setup.ts. The preview gate is off for these tests only,
// through process env (no key anywhere); the gate itself is tested in tests/worker/gate.test.ts.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 360, height: 740 },
    locale: 'en-CA',
    timezoneId: 'America/Vancouver',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/api/hosts/properties',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', PREVIEW_GATE: 'off', WRANGLER_SEND_METRICS: 'false' },
  },
});
