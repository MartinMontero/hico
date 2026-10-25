import { ASSET_PATH, CONTENT_API, NETWORK_TIMEOUT_MS } from '../../shared/offline.ts';

// The service worker's decisions, as plain functions so tests can run them without a browser. sw.ts wires them to events.
// Rules (05 §12): content is network-first with a short timeout, then the kept copy; built assets are served from their
// copy; staff pages and APIs, anything that is not a GET, and any response that could carry a session are never touched.

export type Plan = 'navigate' | 'content' | 'asset';

export function classify(req: { method: string; mode: string; url: string }, origin: string): Plan | null {
  if (req.method !== 'GET') return null;
  const url = new URL(req.url);
  if (url.origin !== origin) return null;
  const path = url.pathname;
  if (path.startsWith('/api/staff') || path === '/staff' || path.startsWith('/staff/')) return null;
  if (CONTENT_API.test(path)) return 'content';
  if (ASSET_PATH.test(path) || path === '/manifest.webmanifest' || path === '/icon.svg') return 'asset';
  if (req.mode === 'navigate' && !path.startsWith('/api/')) return 'navigate';
  return null;
}

/** A response worth keeping: a normal success from this site that says nothing against being kept. */
export function cacheable(res: Response): boolean {
  return res.ok && res.type !== 'opaque' && res.type !== 'error' && !/no-store|private/i.test(res.headers.get('Cache-Control') ?? '');
}

/** The kept copy, marked so the page does not trust its Date header as "now" (web/src/clock.ts). */
export function fromCache(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('X-From-Cache', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export interface Deps {
  caches: CacheStorage;
  fetch: (req: Request) => Promise<Response>;
  /** Resolves 'timeout' after the given time. */
  timeout: (ms: number) => Promise<'timeout'>;
  /** Lets the network answer finish storing after the response has gone out. */
  waitUntil: (p: Promise<unknown>) => void;
}

export const SHELL = '/';

/** The key a response is kept under: every page navigation shares the one shell (the app is a single-page app). */
const keyFor = (req: Request, plan: Plan): string => (plan === 'navigate' ? SHELL : req.url);

export async function handle(req: Request, plan: Plan, deps: Deps, names: { content: string; assets: string }): Promise<Response> {
  const store = await deps.caches.open(plan === 'asset' ? names.assets : names.content);
  const key = keyFor(req, plan);

  if (plan === 'asset') {
    const kept = await store.match(key);
    if (kept) return kept;
    const res = await deps.fetch(req);
    if (cacheable(res)) await store.put(key, res.clone());
    return res;
  }

  // Network first. If the network is slow, show the kept copy and let the network answer finish updating it.
  const network = deps.fetch(req).then(async (res) => {
    if (cacheable(res)) await store.put(key, res.clone());
    return res;
  });
  const settle = network.then(
    (res) => ({ res }),
    () => ({ res: null as Response | null }),
  );
  const first = await Promise.race([settle, deps.timeout(NETWORK_TIMEOUT_MS)]);
  if (first !== 'timeout' && first.res) return first.res;
  const kept = await store.match(key);
  if (kept) {
    deps.waitUntil(settle);
    return fromCache(kept);
  }
  return network; // nothing kept: wait for the network, or let its failure reach the page
}

export async function switchedOff(fetchStatus: () => Promise<Response>): Promise<boolean> {
  try {
    const res = await fetchStatus();
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: unknown };
    return body.enabled === false;
  } catch {
    return false;
  }
}