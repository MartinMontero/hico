// Bindings of the Worker. Hand-written: `wrangler types` is not used (no Cloudflare contact).
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    PREVIEW_GATE?: string;
    /** Secret. Read with whitespace trimmed (CLAUDE.md). Absent locally unless set in .dev.vars. */
    ACCESS_KEY?: string;
    /** Test-only: migrations handed to the Workers test pool. */
    TEST_MIGRATIONS?: import('@cloudflare/vitest-plugin').D1Migration[];
  }
}
type Env = Cloudflare.Env;
