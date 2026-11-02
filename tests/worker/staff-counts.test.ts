import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from '../support/app.ts';
import { makeProperty, makeStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

let A: PropertyFixture, B: PropertyFixture;
let adminA: string, editorA: string, adminB: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'counts-a', { host: 'counts-a.test' });
  B = await makeProperty(env.DB, 'counts-b', { host: 'counts-b.test' });
  adminA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin@counts.test', [{ propertyId: A.id, role: 'admin' }]));
  editorA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'editor@counts.test', [{ propertyId: A.id, role: 'editor' }]));
  adminB = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin-b@counts.test', [{ propertyId: B.id, role: 'admin' }]));
  const add = env.DB.prepare('INSERT INTO event_counts (property_id, day, event, count) VALUES (?1, ?2, ?3, ?4)');
  await add.bind(A.id, '2026-10-25', 'qr:desk', 3).run();
  await add.bind(A.id, '2026-10-25', 'opened_whats_on', 5).run();
  await add.bind(A.id, '2026-10-24', 'qr:desk', 2).run();
  await add.bind(B.id, '2026-10-25', 'qr:roof', 99).run();
});

const counts = (slug: string, host: string, cookie: string, query = '') =>
  call(`/api/staff/p/${slug}/counts${query}`, { host, headers: { Cookie: cookie } });

describe('property aggregate counts', () => {
  it('an admin sees only this property totals, newest day first', async () => {
    const res = await counts(A.slug, A.host, adminA);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { day: '2026-10-25', event: 'opened_whats_on', count: 5 },
      { day: '2026-10-25', event: 'qr:desk', count: 3 },
      { day: '2026-10-24', event: 'qr:desk', count: 2 },
    ]);
  });

  it('an optional day limits the report without changing its shape', async () => {
    const res = await counts(A.slug, A.host, adminA, '?day=2026-10-24');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ day: '2026-10-24', event: 'qr:desk', count: 2 }]);
    expect((await counts(A.slug, A.host, adminA, '?day=25-10-2026')).status).toBe(400);
  });

  it('an editor, another property admin and a signed-out request cannot read them', async () => {
    expect((await counts(A.slug, A.host, editorA)).status).toBe(403);
    expect((await counts(A.slug, A.host, adminB)).status).toBe(404);
    expect((await call(`/api/staff/p/${A.slug}/counts`, { host: A.host })).status).toBe(401);
  });
});
