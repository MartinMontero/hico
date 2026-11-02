import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from '../support/app.ts';
import { makeActivity, makeOffer, makePlace, makeProperty, makeStaff, makeZone, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';
import type { ContentHealthReport } from '../../shared/content-health.ts';

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
let A: PropertyFixture, B: PropertyFixture, Empty: PropertyFixture;
let adminA: string, editorA: string, adminB: string, adminEmpty: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'health-a', { host: 'health-a.test' });
  B = await makeProperty(env.DB, 'health-b', { host: 'health-b.test' });
  Empty = await makeProperty(env.DB, 'health-empty', { host: 'health-empty.test' });
  adminA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin@health.test', [{ propertyId: A.id, role: 'admin' }]));
  editorA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'editor@health.test', [{ propertyId: A.id, role: 'editor' }]));
  adminB = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin-b@health.test', [{ propertyId: B.id, role: 'admin' }]));
  adminEmpty = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin-empty@health.test', [{ propertyId: Empty.id, role: 'admin' }]));

  await makeZone(env.DB, A.id, 'A lobby');
  await makeActivity(env.DB, A.id, [A.id], 'A unchecked activity');
  const stalePlace = await makePlace(env.DB, A.id, 'A stale place');
  await env.DB.prepare('UPDATE places SET verified_on = ?2, verified_by = ?3 WHERE id = ?1').bind(stalePlace, NOW - 91 * DAY, 'A staff').run();
  await makeOffer(env.DB, A.id, NOW, 'A current offer');
  await makePlace(env.DB, B.id, 'B private unchecked place');
});

const health = (slug: string, host: string, cookie: string) =>
  call(`/api/staff/p/${slug}/content-health`, {
    host, headers: { Cookie: cookie }, appOptions: { now: () => NOW },
  });

describe('property content health', () => {
  it('separates unchecked, stale and sample content without exposing another property', async () => {
    const res = await health(A.slug, A.host, adminA);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const report = await res.json<ContentHealthReport>();
    expect(report.generatedAt).toBe(NOW);
    expect(report.summaries).toEqual([
      { kind: 'activities', total: 1, missing: false, unverified: 1, stale: 0, placeholder: 0 },
      { kind: 'places', total: 1, missing: false, unverified: 0, stale: 1, placeholder: 0 },
      { kind: 'offers', total: 1, missing: false, unverified: 0, stale: 0, placeholder: 0 },
      { kind: 'zones', total: 1, missing: false, unverified: 0, stale: 0, placeholder: 0 },
    ]);
    expect(report.items.map((item) => ({ kind: item.kind, title: item.title, reasons: item.reasons }))).toEqual([
      { kind: 'activities', title: 'A unchecked activity', reasons: ['unverified'] },
      { kind: 'places', title: 'A stale place', reasons: ['stale'] },
    ]);
    expect(JSON.stringify(report)).not.toContain('B private unchecked place');
  });

  it('marks every content type missing for an empty property', async () => {
    const res = await health(Empty.slug, Empty.host, adminEmpty);
    const report = await res.json<ContentHealthReport>();
    expect(res.status).toBe(200);
    expect(report.summaries.every((summary) => summary.missing && summary.total === 0)).toBe(true);
    expect(report.items).toEqual([]);
  });

  it('is admin-only and closed to another property and signed-out requests', async () => {
    expect((await health(A.slug, A.host, editorA)).status).toBe(403);
    expect((await health(A.slug, A.host, adminB)).status).toBe(404);
    expect((await call(`/api/staff/p/${A.slug}/content-health`, { host: A.host })).status).toBe(401);
  });
});
