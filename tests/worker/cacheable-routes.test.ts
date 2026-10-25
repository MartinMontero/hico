import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { CONTENT_API } from '../../shared/offline.ts';
import { call } from '../support/app.ts';
import { makeProperty, type PropertyFixture } from '../support/fixtures.ts';

// The service worker may keep a response only for a public read that sets no cookie and depends on none (05 §12).
// This calls every such route and holds the server to that promise.

let P: PropertyFixture;
beforeAll(async () => {
  P = await makeProperty(env.DB, 'sw-a', { host: 'sw-a.test' });
});

const kept = ['/api/hosts/properties', '/api/p/sw-a/config', '/api/p/sw-a/activities', '/api/p/sw-a/places', '/api/p/sw-a/offers'];

describe('the routes the service worker keeps', () => {
  it('are exactly the ones its pattern allows', () => {
    for (const path of kept) expect(CONTENT_API.test(path), path).toBe(true);
  });

  it.each(kept)('%s sets no cookie, reads no cookie, and does not forbid being kept', async (path) => {
    const plain = await call(path, { host: P.host });
    const withCookie = await call(path, { host: P.host, headers: { Cookie: 'hc_staff=whatever; other=1' } });
    expect(plain.status).toBe(200);
    for (const r of [plain, withCookie]) {
      expect(r.headers.get('Set-Cookie')).toBeNull();
      expect(r.headers.get('Cache-Control') ?? '').not.toMatch(/no-store|private/i);
    }
    expect(await withCookie.text()).toBe(await plain.clone().text()); // the same body with or without a cookie
  });

  it('a staff response forbids being kept, as a second line of defence behind the service worker\'s own list', async () => {
    const res = await call('/api/staff/auth/me', { host: P.host });
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control') ?? '').toMatch(/no-store|private/i);
  });
});

describe('the service worker script', () => {
  it('is always re-checked, and its off switch is never kept', async () => {
    const script = await call('/sw.js', { host: P.host });
    const status = await call('/sw-status.json', { host: P.host });
    expect(script.headers.get('Cache-Control')).toBe('no-cache');
    expect(status.headers.get('Cache-Control')).toBe('no-store');
  });
});