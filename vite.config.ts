import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// One Vite project: the Preact front end (index.html + web/) and the Hono Worker
// (worker/index.ts, from wrangler.jsonc). `CLOUDFLARE_ENV=prod` builds the hico-prod config.
export default defineConfig({
  plugins: [preact(), cloudflare({ configPath: './wrangler.jsonc' })],
  build: { sourcemap: false },
});
