import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

// Applies migrations/*.sql to the test D1 before the tests of a file run.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS ?? []);
