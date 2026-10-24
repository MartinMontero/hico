import { env } from 'cloudflare:workers';
import { createApp, type AppOptions } from '../../worker/app.ts';
import { resetReadOnlyCache } from '../../worker/middleware/guards.ts';

/** A stand-in for the static assets binding: any non-API path "is" the SPA shell. */
export const fakeAssets = {
  fetch: async () => new Response('<!doctype html><title>shell</title>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
} as unknown as Fetcher;

export function testEnv(overrides: Partial<Env> = {}): Env {
  return { DB: env.DB, ASSETS: fakeAssets, PREVIEW_GATE: 'off', ...overrides } as Env;
}

export interface CallOptions {
  host?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  env?: Partial<Env>;
  app?: ReturnType<typeof createApp>;
  appOptions?: AppOptions;
}

/** Calls the Worker app as a browser on `host` would (no cookie unless given). */
export async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const host = options.host ?? 'localhost';
  const app = options.app ?? createApp(options.appOptions);
  const headers = new Headers(options.headers);
  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  if (init.method !== 'GET' && !headers.has('Origin')) headers.set('Origin', `https://${host}`);
  return app.request(`https://${host}${path}`, init, testEnv(options.env));
}

export { resetReadOnlyCache };
