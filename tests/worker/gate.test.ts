import { afterEach, describe, expect, it, vi } from 'vitest';
import { GATE_COOKIE } from '../../worker/preview-gate/index.ts';
import { call } from '../support/app.ts';

// A made-up key for the tests only. The real preview key is never in any file.
const KEY = 'test-only-key-0123456789';
const gated = { PREVIEW_GATE: 'on', ACCESS_KEY: KEY };

async function sha256hex(value: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

afterEach(() => vi.restoreAllMocks());

describe('preview gate', () => {
  it('gate on and no key: flat 404 on pages, assets, /api/* and unknown paths', async () => {
    for (const path of ['/', '/p/demo/whats-on', '/assets/index.js', '/api/hosts/properties', '/api/p/x/config', '/api/nothing', '/staff/p/x/me']) {
      const res = await call(path, { env: gated });
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toBe('Not Found\n');
    }
  });

  it('writes are refused too (404, not 403)', async () => {
    const res = await call('/api/p/x/events', { method: 'POST', body: { event: 'opened_whats_on' }, env: gated });
    expect(res.status).toBe(404);
  });

  it('/robots.txt answers Disallow even with the gate on', async () => {
    const res = await call('/robots.txt', { env: gated });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('fails closed: gate on and no ACCESS_KEY bound serves nothing', async () => {
    for (const env of [{ PREVIEW_GATE: 'on' }, { PREVIEW_GATE: 'on', ACCESS_KEY: '' }, { PREVIEW_GATE: 'on', ACCESS_KEY: '   ' }]) {
      expect((await call('/', { env })).status).toBe(404);
      expect((await call('/api/hosts/properties', { env })).status).toBe(404);
    }
  });

  it('correct key: 302 to the same path without k, with an HttpOnly Secure SameSite=Lax cookie holding a hash', async () => {
    const res = await call(`/p/demo/explore?k=${KEY}&lang=fr`, { env: gated });
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toBe('/p/demo/explore?lang=fr');
    expect(location).not.toContain(KEY);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie.startsWith(`${GATE_COOKIE}=`)).toBe(true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain(KEY);
    expect(cookie).toContain(await sha256hex(KEY));
    expect(await res.text()).not.toContain(KEY);
  });

  it('the cookie then passes every path, including /api/*, and never serves from a shared cache', async () => {
    const cookie = `${GATE_COOKIE}=${await sha256hex(KEY)}`;
    const page = await call('/p/demo/whats-on', { env: gated, headers: { Cookie: cookie } });
    expect(page.status).toBe(200);
    expect(page.headers.get('Cache-Control')).toBe('private, no-store');
    const api = await call('/api/hosts/properties', { env: gated, headers: { Cookie: cookie } });
    expect(api.status).toBe(200);
  });

  it('a wrong key, a forged cookie and a differently named cookie are all 404', async () => {
    expect((await call('/?k=wrong', { env: gated })).status).toBe(404);
    expect((await call('/', { env: gated, headers: { Cookie: `${GATE_COOKIE}=forged` } })).status).toBe(404);
    expect((await call('/', { env: gated, headers: { Cookie: `evil_${GATE_COOKIE}=${await sha256hex(KEY)}` } })).status).toBe(404);
    // The raw key is not accepted as the cookie value: the cookie holds the hash.
    expect((await call('/', { env: gated, headers: { Cookie: `${GATE_COOKIE}=${KEY}` } })).status).toBe(404);
  });

  it('a key with surrounding whitespace in the secret still works (secrets are trimmed)', async () => {
    const res = await call(`/?k=${KEY}`, { env: { PREVIEW_GATE: 'on', ACCESS_KEY: `${KEY}\r\n` } });
    expect(res.status).toBe(302);
  });

  it('gate off: nothing changes', async () => {
    expect((await call('/api/hosts/properties', { env: { PREVIEW_GATE: 'off' } })).status).toBe(200);
  });

  it('the key never appears in a response body, a header value, or a log line after the redeem request', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(' ')));
    const cookie = `${GATE_COOKIE}=${await sha256hex(KEY)}`;
    const responses = [
      await call(`/?k=${KEY}`, { env: gated }),
      await call('/', { env: gated, headers: { Cookie: cookie } }),
      await call('/api/hosts/properties', { env: gated, headers: { Cookie: cookie } }),
      await call('/nope', { env: gated }),
      await call('/robots.txt', { env: gated }),
    ];
    for (const res of responses) {
      expect(await res.text()).not.toContain(KEY);
      for (const [name, value] of res.headers) expect(`${name}: ${value}`, name).not.toContain(KEY);
    }
    // The redirect target after the first redirect carries no key.
    expect(responses[0]?.headers.get('Location')).not.toContain('k=');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toContain(KEY);
  });

  it('crawlers and caches are told to stay away on every gated response', async () => {
    const res = await call('/', { env: gated });
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
