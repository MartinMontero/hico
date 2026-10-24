import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../worker/app.ts';
import { call } from '../support/app.ts';
import { ROUTES, ZERO, type Row } from '../support/staff-routes.ts';
import { makeProperty, makeStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

// The role matrix: every property-scoped staff route, as signed-out, as staff of another property only,
// as an editor and as an admin. A route that is not in ROUTES fails the completeness test, so a new
// route cannot ship without a row here. Mutating routes must also name the audit action they write.

const concrete = (p: string) => p.replace(':id', ZERO).replace(':name', 'common_room');

let A: PropertyFixture, B: PropertyFixture;
let cEditorA: string, cAdminA: string, cAdminB: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'mx-a', { host: 'mx-a.test' });
  B = await makeProperty(env.DB, 'mx-b', { host: 'mx-b.test' });
  cEditorA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'editor@mx.test', [{ propertyId: A.id, role: 'editor' }]));
  cAdminA = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin@mx.test', [{ propertyId: A.id, role: 'admin' }]));
  cAdminB = await sessionCookieFor(env.DB, await makeStaff(env.DB, 'admin-b@mx.test', [{ propertyId: B.id, role: 'admin' }]));
});

const hit = (row: Row, slug: string, host: string, cookie?: string) =>
  call(`/api/staff/p/${slug}${concrete(row.path)}`, { host, method: row.method, headers: cookie ? { Cookie: cookie } : {}, body: row.method === 'POST' ? {} : undefined });

describe.each(ROUTES)('$method $path', (row) => {
  it('signed out: 401, and nothing else about the property is revealed', async () => {
    const res = await hit(row, 'mx-a', A.host);
    expect(res.status).toBe(401);
    const unknown = await hit(row, 'no-such-hostel', A.host);
    expect(await res.text()).toBe(await unknown.text());
  });

  it('staff of another property only: 404, identical to a property that does not exist', async () => {
    const res = await hit(row, 'mx-a', A.host, cAdminB);
    expect(res.status).toBe(404);
    const unknown = await hit(row, 'no-such-hostel', A.host, cAdminB);
    expect(unknown.status).toBe(404);
    expect(await res.text()).toBe(await unknown.text());
  });

  it(row.admin ? 'editor: 403' : 'editor: allowed through the role check', async () => {
    const res = await hit(row, 'mx-a', A.host, cEditorA);
    if (row.admin) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    } else {
      expect([401, 403].includes(res.status) && !(res.status === 403 && /activities\/.*\/(delete|offered-at)/.test(row.path))).toBe(false);
    }
  });

  it('admin: allowed through the role check (any other failure is about the request, not the role)', async () => {
    const res = await hit(row, 'mx-a', A.host, cAdminA);
    expect(res.status).not.toBe(401);
    if (res.status === 403) {
      // Only the owner-admin rules on a shared activity may say 403 to an admin, and not for a nonexistent id.
      expect(await res.json()).not.toEqual({ error: 'forbidden' });
    }
  });
});

describe('completeness', () => {
  it('the table lists exactly the property-scoped staff routes the app serves', () => {
    const served = new Set(createApp().routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api/staff/p/:slug')).map((r) => `${r.method} ${r.path.replace('/api/staff/p/:slug', '')}`));
    const listed = new Set(ROUTES.map((r) => `${r.method} ${r.path}`));
    expect([...served].filter((s) => !listed.has(s)), 'served but not in the matrix').toEqual([]);
    expect([...listed].filter((s) => !served.has(s)), 'in the matrix but not served').toEqual([]);
  });
});
