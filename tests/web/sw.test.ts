import { describe, expect, it } from 'vitest';
import { CACHE_NAMES, CONTENT_API, NETWORK_TIMEOUT_MS } from '../../shared/offline.ts';
import { cacheable, classify, handle, switchedOff, type Deps } from '../../web/sw/logic.ts';

// The service worker's rules (05 §12), run without a browser against a fake Cache Storage.

const ORIGIN = 'https://hostel.test';
const req = (path: string, init: { method?: string; mode?: string } = {}) => ({ method: init.method ?? 'GET', mode: init.mode ?? 'cors', url: `${ORIGIN}${path}` });
const names = { content: CACHE_NAMES.content, assets: CACHE_NAMES.assets };

class FakeCache {
  store = new Map<string, Response>();
  async match(key: string | Request) {
    return this.store.get(typeof key === 'string' ? key : new URL(key.url).pathname === '/' ? '/' : key.url)?.clone();
  }
  async put(key: string | Request, res: Response) {
    this.store.set(typeof key === 'string' ? key : key.url, res);
  }
}
class FakeCaches {
  all = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.all.has(name)) this.all.set(name, new FakeCache());
    return this.all.get(name) as FakeCache;
  }
  keysOf(name: string) {
    return [...(this.all.get(name)?.store.keys() ?? [])];
  }
}

function deps(over: Partial<Omit<Deps, 'caches'>> & { caches?: FakeCaches } = {}) {
  const caches = over.caches ?? new FakeCaches();
  const pending: Promise<unknown>[] = [];
  const timeouts: number[] = [];
  const d: Deps = {
    caches: caches as unknown as CacheStorage,
    fetch: over.fetch ?? (async () => new Response('{}', { status: 200 })),
    timeout: over.timeout ?? ((ms) => { timeouts.push(ms); return new Promise(() => {}); }), // never fires unless a test says so
    waitUntil: (p) => void pending.push(p),
  };
  return { d, caches, pending, timeouts };
}
const get = (path: string, mode = 'cors') => new Request(`${ORIGIN}${path}`, { method: 'GET', mode: mode === 'navigate' ? 'same-origin' : (mode as RequestMode) });

describe('what the service worker handles', () => {
  it('handles the public reads, built assets and page navigations, and nothing else', () => {
    expect(classify(req('/api/p/whistler/activities'), ORIGIN)).toBe('content');
    expect(classify(req('/api/p/whistler/config'), ORIGIN)).toBe('content');
    expect(classify(req('/api/hosts/properties'), ORIGIN)).toBe('content');
    expect(classify(req('/assets/index-abc.js'), ORIGIN)).toBe('asset');
    expect(classify(req('/fonts/dm-sans-latin-400-normal.woff2'), ORIGIN)).toBe('asset');
    expect(classify(req('/p/whistler/whats-on', { mode: 'navigate' }), ORIGIN)).toBe('navigate');
  });

  it('never handles staff pages or APIs, a POST, another site, or an API route that is not a public read', () => {
    for (const r of [
      req('/staff', { mode: 'navigate' }), req('/staff/p/whistler/board', { mode: 'navigate' }), req('/staff/accept', { mode: 'navigate' }),
      req('/api/staff/auth/me'), req('/api/staff/p/whistler/people'),
      req('/api/p/whistler/events', { method: 'POST' }), req('/api/p/whistler/qr', { method: 'POST' }), req('/api/p/whistler/activities', { method: 'POST' }),
      req('/api/p/whistler/offers/extra'), req('/api/unknown'),
    ]) expect(classify(r, ORIGIN), `${r.method} ${r.url}`).toBeNull();
    expect(classify({ method: 'GET', mode: 'cors', url: 'https://elsewhere.test/assets/x.js' }, ORIGIN)).toBeNull();
  });

  it('the content pattern matches exactly the public reads', () => {
    for (const ok of ['/api/hosts/properties', '/api/p/a-b/config', '/api/p/x/activities', '/api/p/x/places', '/api/p/x/offers']) expect(CONTENT_API.test(ok), ok).toBe(true);
    for (const no of ['/api/p/x/events', '/api/p/x/qr', '/api/staff/p/x/activities', '/api/p/X/places', '/api/p/x/places/1', '/api/p/x/offers?x=1']) expect(CONTENT_API.test(no), no).toBe(false);
  });
});

describe('what is kept', () => {
  const res = (headers: Record<string, string> = {}, status = 200) => new Response('{"ok":true}', { status, headers });
  it('only a normal success that does not say no-store or private', () => {
    expect(cacheable(res())).toBe(true);
    expect(cacheable(res({ 'Cache-Control': 'public, max-age=60' }))).toBe(true);
    expect(cacheable(res({ 'Cache-Control': 'private, no-store' }))).toBe(false);
    expect(cacheable(res({ 'Cache-Control': 'no-store' }))).toBe(false);
    expect(cacheable(res({ 'Cache-Control': 'private' }))).toBe(false);
    expect(cacheable(res({}, 404))).toBe(false);
    expect(cacheable(res({}, 500))).toBe(false);
  });
});

describe('content, network first', () => {
  it('uses the network and keeps the answer', async () => {
    const { d, caches } = deps({ fetch: async () => new Response('[1]', { status: 200 }) });
    const r = await handle(get('/api/p/w/activities'), 'content', d, names);
    expect(await r.text()).toBe('[1]');
    expect(r.headers.get('X-From-Cache')).toBeNull();
    expect(caches.keysOf(names.content)).toEqual([`${ORIGIN}/api/p/w/activities`]);
  });

  it('serves the kept copy, marked as kept, when the network fails', async () => {
    const caches = new FakeCaches();
    await handle(get('/api/p/w/activities'), 'content', deps({ caches, fetch: async () => new Response('[old]', { status: 200 }) }).d, names);
    const { d } = deps({ caches, fetch: async () => { throw new TypeError('offline'); } });
    const r = await handle(get('/api/p/w/activities'), 'content', d, names);
    expect(await r.text()).toBe('[old]');
    expect(r.headers.get('X-From-Cache')).toBe('1');
  });

  it('after the timeout shows the kept copy and lets the network answer finish updating it', async () => {
    const caches = new FakeCaches();
    await handle(get('/api/p/w/places'), 'content', deps({ caches, fetch: async () => new Response('[old]', { status: 200 }) }).d, names);
    let release: (r: Response) => void = () => {};
    const slow = new Promise<Response>((resolve) => { release = resolve; });
    const { d, pending, timeouts } = deps({ caches, fetch: () => slow, timeout: async (ms) => { timeouts2.push(ms); return 'timeout'; } });
    const timeouts2: number[] = [];
    const r = await handle(get('/api/p/w/places'), 'content', d, names);
    expect(timeouts2).toEqual([NETWORK_TIMEOUT_MS]); // the one assumed number, from shared/offline.ts
    expect(timeouts).toEqual([]);
    expect(await r.text()).toBe('[old]');
    expect(r.headers.get('X-From-Cache')).toBe('1');
    release(new Response('[new]', { status: 200 }));
    await Promise.all(pending);
    const kept = await (await caches.open(names.content)).match(`${ORIGIN}/api/p/w/places`);
    expect(await kept?.text()).toBe('[new]');
  });

  it('with nothing kept, waits for the network, and lets its failure reach the page', async () => {
    const { d } = deps({ fetch: async () => { throw new TypeError('offline'); } });
    await expect(handle(get('/api/p/w/offers'), 'content', d, names)).rejects.toThrow('offline');
  });

  it('never keeps an error, a no-store response or a private one, so a stale error cannot replace good content', async () => {
    for (const make of [() => new Response('x', { status: 500 }), () => new Response('x', { status: 200, headers: { 'Cache-Control': 'no-store' } }), () => new Response('x', { status: 200, headers: { 'Cache-Control': 'private' } })]) {
      const { d, caches } = deps({ fetch: async () => make() });
      await handle(get('/api/p/w/config'), 'content', d, names);
      expect(caches.keysOf(names.content)).toEqual([]);
    }
  });
});

describe('navigation and assets', () => {
  it('keeps one shell for every page, and opens it offline', async () => {
    const caches = new FakeCaches();
    await handle(get('/p/w/whats-on', 'navigate'), 'navigate', deps({ caches, fetch: async () => new Response('<html>shell</html>', { status: 200 }) }).d, names);
    expect(caches.keysOf(names.content)).toEqual(['/']);
    const { d } = deps({ caches, fetch: async () => { throw new TypeError('offline'); } });
    const r = await handle(get('/p/w/explore', 'navigate'), 'navigate', d, names);
    expect(await r.text()).toBe('<html>shell</html>');
    expect(r.headers.get('X-From-Cache')).toBe('1');
  });

  it('serves a built asset from its copy without asking the network again', async () => {
    const caches = new FakeCaches();
    let calls = 0;
    const fetcher = async () => { calls += 1; return new Response('js', { status: 200 }); };
    await handle(get('/assets/a.js'), 'asset', deps({ caches, fetch: fetcher }).d, names);
    const r = await handle(get('/assets/a.js'), 'asset', deps({ caches, fetch: fetcher }).d, names);
    expect(await r.text()).toBe('js');
    expect(calls).toBe(1);
    expect(caches.keysOf(names.assets)).toHaveLength(1);
    expect(caches.keysOf(names.content)).toEqual([]);
  });
});

describe('nothing a session could touch is ever kept', () => {
  it('a run through staff, POST and other-site requests keeps nothing at all', async () => {
    const { d, caches } = deps();
    for (const r of [req('/api/staff/auth/me'), req('/api/staff/p/w/people'), req('/staff/p/w/board', { mode: 'navigate' }), req('/api/p/w/qr', { method: 'POST' })]) {
      const plan = classify(r, ORIGIN);
      if (plan) await handle(new Request(r.url), plan, d, names);
    }
    expect(caches.all.size).toBe(0);
  });
});

describe('the operator\'s off switch', () => {
  it('is on only when the status file says enabled is false', async () => {
    expect(await switchedOff(async () => new Response('{"enabled": false}'))).toBe(true);
    expect(await switchedOff(async () => new Response('{"enabled": true}'))).toBe(false);
    expect(await switchedOff(async () => new Response('nonsense'))).toBe(false);
    expect(await switchedOff(async () => new Response('{}', { status: 404 }))).toBe(false);
    expect(await switchedOff(async () => { throw new TypeError('offline'); })).toBe(false);
  });
});