import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

const migrations = await readD1Migrations('./migrations');

export default defineConfig({
  test: {
    projects: [
      {
        // Runs inside workerd with a real local D1 database.
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: '2026-08-07',
              d1Databases: ['DB'],
              bindings: { TEST_MIGRATIONS: migrations },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          setupFiles: ['./tests/support/apply-migrations.ts'],
        },
      },
      {
        test: { name: 'node', include: ['tests/node/**/*.test.ts'], environment: 'node' },
      },
      {
        oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
        test: { name: 'web', include: ['tests/web/**/*.test.{ts,tsx}'], environment: 'jsdom' },
      },
    ],
  },
});
