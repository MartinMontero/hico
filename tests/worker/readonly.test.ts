import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProperty } from '../support/fixtures.ts';
import { call, resetReadOnlyCache } from '../support/app.ts';
import { events } from '../../worker/repositories/index.ts';
import { createTenantContext } from '../../worker/tenant.ts';

async function setFlag(value: 'on' | 'off'): Promise<void> {
  await env.DB.prepare("UPDATE platform_flags SET value = ?1 WHERE key = 'read_only'").bind(value).run();
}

beforeEach(() => resetReadOnlyCache());
afterEach(async () => {
  vi.useRealTimers();
  await setFlag('off');
  resetReadOnlyCache();
});

describe('global read-only switch', () => {
  it('off: the state-changing route works', async () => {
    const p = await makeProperty(env.DB, 'ro-off', { host: 'ro-off.test' });
    const res = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body: { event: 'opened_whats_on' } });
    expect(res.status).toBe(204);
    const ctx = createTenantContext(env.DB, { propertyId: p.id, slug: p.slug, timezone: 'UTC' });
    expect(await events.countFor(ctx, new Date().toISOString().slice(0, 10), 'opened_whats_on')).toBe(1);
  });

  it('on: every state-changing method answers 503 with a plain message, and nothing is written', async () => {
    const p = await makeProperty(env.DB, 'ro-on', { host: 'ro-on.test' });
    await setFlag('on');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await call(`/api/p/${p.slug}/events`, { host: p.host, method, body: { event: 'opened_whats_on' } });
      expect(res.status, method).toBe(503);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('read_only');
      expect(body.message).toMatch(/read-only/i);
      expect(res.headers.get('Retry-After')).toBe('60');
    }
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM event_counts WHERE property_id = ?1').bind(p.id).first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it('on: reads keep working', async () => {
    const p = await makeProperty(env.DB, 'ro-read', { host: 'ro-read.test' });
    await setFlag('on');
    expect((await call(`/api/p/${p.slug}/config`, { host: p.host })).status).toBe(200);
    expect((await call('/api/hosts/properties', { host: p.host })).status).toBe(200);
    expect((await call('/', { host: p.host })).status).toBe(200);
  });

  it('the message follows the guest\'s language, English by default', async () => {
    const p = await makeProperty(env.DB, 'ro-lang', { host: 'ro-lang.test' });
    await setFlag('on');
    const fr = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body: { event: 'opened_whats_on' }, headers: { 'Accept-Language': 'fr-CA,fr;q=0.9' } });
    expect(((await fr.json()) as { message: string }).message).toMatch(/lecture seule/);
    const de = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body: { event: 'opened_whats_on' }, headers: { 'Accept-Language': 'de' } });
    expect(((await de.json()) as { message: string }).message).toMatch(/read-only/);
  });

  it('is read on each request with a few seconds of caching', async () => {
    const p = await makeProperty(env.DB, 'ro-cache', { host: 'ro-cache.test' });
    const post = () => call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body: { event: 'opened_whats_on' } });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    expect((await post()).status).toBe(204); // reads "off" and caches it
    await setFlag('on');
    vi.setSystemTime(new Date('2026-10-23T12:00:03Z'));
    expect((await post()).status).toBe(204); // still inside the 5 s window
    vi.setSystemTime(new Date('2026-10-23T12:00:06Z'));
    expect((await post()).status).toBe(503); // window over: the flag is read again
    await setFlag('off');
    vi.setSystemTime(new Date('2026-10-23T12:00:12Z'));
    expect((await post()).status).toBe(204);
  });
});

describe('write guards (05 §4 rule 9)', () => {
  it('a write without a matching Origin or without JSON is refused', async () => {
    const p = await makeProperty(env.DB, 'wg', { host: 'wg.test' });
    const noOrigin = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body: { event: 'opened_whats_on' }, headers: { Origin: 'https://evil.example' } });
    expect(noOrigin.status).toBe(403);
    const notJson = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', headers: { 'Content-Type': 'text/plain' } });
    expect(notJson.status).toBe(415);
  });

  it('only allow-listed event names are counted, with no extra fields', async () => {
    const p = await makeProperty(env.DB, 'wg-ev', { host: 'wg-ev.test' });
    for (const body of [{ event: 'made_up' }, { event: 'opened_whats_on', extra: 1 }, {}, 'x']) {
      const res = await call(`/api/p/${p.slug}/events`, { host: p.host, method: 'POST', body });
      expect(res.status).toBe(400);
    }
  });
});
