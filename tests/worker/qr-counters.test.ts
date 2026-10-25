import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from '../support/app.ts';
import { makeProperty, type PropertyFixture } from '../support/fixtures.ts';

// QR scans and the aggregate counters (05 §7, §10): a count per (property, day, event) and nothing about the guest.

let A: PropertyFixture, B: PropertyFixture;
const NOW = Date.parse('2026-10-25T12:00:00Z') / 1000;
const appOptions = { now: () => NOW };
const DAY = '2026-10-25';

const scan = (p: PropertyFixture, label: unknown, headers: Record<string, string> = {}) =>
  call(`/api/p/${p.slug}/qr`, { host: p.host, method: 'POST', headers, body: { label }, appOptions });
const rows = async (p: PropertyFixture) =>
  (await env.DB.prepare('SELECT day, event, count FROM event_counts WHERE property_id = ?1 ORDER BY event').bind(p.id).all<{ day: string; event: string; count: number }>()).results;
const addLabel = (p: PropertyFixture, label: string, retiredAt: number | null = null) =>
  env.DB.prepare("INSERT INTO entry_codes (id, property_id, label, token_hash, created_at, revoked_at) VALUES (?1, ?2, ?3, '', 1, ?4)").bind(crypto.randomUUID().replaceAll('-', ''), p.id, label, retiredAt).run();

beforeAll(async () => {
  A = await makeProperty(env.DB, 'qr-a', { host: 'qr-a.test' });
  B = await makeProperty(env.DB, 'qr-b', { host: 'qr-b.test' });
  await addLabel(A, 'desk');
  await addLabel(A, 'kitchen', 5);
  await addLabel(B, 'rooftop');
});

describe('a scan of a labelled QR link', () => {
  it('adds one to the count for this property, this UTC day and this label, each time', async () => {
    expect((await scan(A, 'desk')).status).toBe(204);
    expect((await scan(A, 'desk')).status).toBe(204);
    expect(await rows(A)).toEqual([{ day: DAY, event: 'qr:desk', count: 2 }]);
  });

  it('sets no cookie and answers the same whether or not the label exists', async () => {
    const known = await scan(A, 'desk');
    const unknown = await scan(A, 'no-such-label');
    expect(known.headers.get('Set-Cookie')).toBeNull();
    expect(unknown.headers.get('Set-Cookie')).toBeNull();
    expect(unknown.status).toBe(known.status);
    expect(await unknown.text()).toBe(await known.text());
  });

  it('counts only a label this property has created and not retired', async () => {
    await scan(A, 'made-up');
    await scan(A, 'kitchen'); // retired
    await scan(A, 'rooftop'); // another property's label
    const events = (await rows(A)).map((r) => r.event);
    expect(events).toEqual(['qr:desk']);
    expect(await rows(B)).toEqual([]); // and A's scans never touched B
  });

  it('a label of the other property counts there, and only there', async () => {
    await scan(B, 'rooftop');
    expect(await rows(B)).toEqual([{ day: DAY, event: 'qr:rooftop', count: 1 }]);
    expect((await rows(A)).map((r) => r.event)).toEqual(['qr:desk']);
  });

  it('refuses a label that could not exist, and anything else in the body', async () => {
    for (const label of ['', 'Desk', 'a b', 'x'.repeat(41), 'a;drop', 5, null]) expect((await scan(A, label)).status, String(label)).toBe(400);
    const extra = await call(`/api/p/${A.slug}/qr`, { host: A.host, method: 'POST', body: { label: 'desk', session: 'abc' }, appOptions });
    expect(extra.status).toBe(400);
  });
});

describe('the counter table holds no person (05 §10)', () => {
  it('has exactly four columns, none of which can hold a session id, user agent or address', async () => {
    const info = (await env.DB.prepare("SELECT name FROM pragma_table_info('event_counts')").all<{ name: string }>()).results.map((r) => r.name);
    expect(info.sort()).toEqual(['count', 'day', 'event', 'property_id']);
  });

  it('a count made with a user agent, a cookie and an address leaves none of them in the database', async () => {
    const marks = { 'User-Agent': 'SECRET-AGENT-STRING', Cookie: 'sid=SECRET-SESSION', 'CF-Connecting-IP': '203.0.113.77', 'X-Forwarded-For': '203.0.113.78', 'Accept-Language': 'fr-CA' };
    await scan(A, 'desk', marks);
    await call(`/api/p/${A.slug}/events`, { host: A.host, method: 'POST', headers: marks, body: { event: 'opened_whats_on' }, appOptions });
    const dump = JSON.stringify((await env.DB.prepare('SELECT property_id, day, event, count FROM event_counts').all()).results);
    for (const secret of ['SECRET-AGENT-STRING', 'SECRET-SESSION', '203.0.113.77', '203.0.113.78', 'fr-CA']) expect(dump).not.toContain(secret);
  });

  it('only the listed events are accepted, and the settings screen is one of them', async () => {
    const send = (event: string) => call(`/api/p/${A.slug}/events`, { host: A.host, method: 'POST', body: { event }, appOptions });
    expect((await send('opened_settings')).status).toBe(204);
    expect((await send('opened_whats_on')).status).toBe(204);
    expect((await send('qr:desk')).status).toBe(400); // QR counts have their own route and their own check
    expect((await send('anything-else')).status).toBe(400);
  });
});