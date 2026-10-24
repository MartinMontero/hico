import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { addHost, makeActivity, makeProperty } from '../support/fixtures.ts';
import { call } from '../support/app.ts';

// D-24: the slug in /api/p/<slug> counts only if it is in the request hostname's own list.

describe('host and slug (D-24)', () => {
  it('unknown host: flat 404', async () => {
    const res = await call('/api/p/anything/config', { host: 'nobody.example' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('listed slug on its own host works', async () => {
    const a = await makeProperty(env.DB, 'hs-a', { host: 'hs-a.test' });
    const res = await call(`/api/p/${a.slug}/config`, { host: a.host });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { slug: string }).slug).toBe('hs-a');
  });

  it('a single-property host answers 404 for another property\'s slug, identical to an unknown slug', async () => {
    const a = await makeProperty(env.DB, 'hs-one-a', { host: 'hs-one-a.test' });
    const b = await makeProperty(env.DB, 'hs-one-b', { host: 'hs-one-b.test' });
    await makeActivity(env.DB, b.id, [b.id], 'B only');
    const other = await call(`/api/p/${b.slug}/activities`, { host: a.host });
    const unknown = await call('/api/p/no-such-slug/activities', { host: a.host });
    expect(other.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await other.text()).toBe(await unknown.text());
  });

  it('a multi-property host serves any slug on its own list and lists only those for the picker', async () => {
    const a = await makeProperty(env.DB, 'hs-m-a', { host: 'hs-multi.test' });
    const b = await makeProperty(env.DB, 'hs-m-b', { host: 'hs-multi.test' });
    const c = await makeProperty(env.DB, 'hs-m-c', { host: 'hs-elsewhere.test' });
    const picker = (await (await call('/api/hosts/properties', { host: 'hs-multi.test' })).json()) as { slug: string }[];
    expect(picker.map((p) => p.slug).sort()).toEqual(['hs-m-a', 'hs-m-b']);
    expect((await call(`/api/p/${b.slug}/config`, { host: 'hs-multi.test' })).status).toBe(200);
    expect((await call(`/api/p/${c.slug}/config`, { host: 'hs-multi.test' })).status).toBe(404);
    expect(a.id).not.toBe(b.id);
  });

  it('a host that lists nothing gets an empty picker', async () => {
    const picker = await (await call('/api/hosts/properties', { host: 'empty.example' })).json();
    expect(picker).toEqual([]);
  });

  it('a property listed on a second host is reachable there too', async () => {
    const a = await makeProperty(env.DB, 'hs-two', { host: 'hs-two-a.test' });
    await addHost(env.DB, a.id, 'hs-two-b.test');
    expect((await call(`/api/p/${a.slug}/config`, { host: 'hs-two-b.test' })).status).toBe(200);
  });

  it('?p=, ?property= and an X-Property header change nothing', async () => {
    const a = await makeProperty(env.DB, 'hs-q-a', { host: 'hs-q.test' });
    const b = await makeProperty(env.DB, 'hs-q-b', { host: 'hs-q-b.test' });
    await makeActivity(env.DB, a.id, [a.id], 'Only A');
    await makeActivity(env.DB, b.id, [b.id], 'Only B');
    const res = await call(`/api/p/${a.slug}/activities?p=${b.slug}&property=${b.id}`, {
      host: 'hs-q.test',
      headers: { 'X-Property': b.slug, 'X-Property-Id': b.id },
    });
    const titles = ((await res.json()) as { title: { en: string } }[]).map((x) => x.title.en);
    expect(titles).toEqual(['Only A']);
  });

  it('a malformed slug is a 404, not an error', async () => {
    for (const slug of ['UPPER', 'a_b', 'a%20b', '..', 'x'.repeat(41)]) {
      const res = await call(`/api/p/${slug}/config`, { host: 'localhost' });
      expect(res.status).toBe(404);
    }
  });

  it('a suspended property is not served', async () => {
    const a = await makeProperty(env.DB, 'hs-susp', { host: 'hs-susp.test' });
    await env.DB.prepare('UPDATE properties SET suspended_at = 5 WHERE id = ?1').bind(a.id).run();
    expect((await call(`/api/p/${a.slug}/config`, { host: a.host })).status).toBe(404);
  });
});
