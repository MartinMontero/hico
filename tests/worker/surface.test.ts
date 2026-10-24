import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { PUBLIC_FIELDS } from '../../shared/types.ts';
import { createApp } from '../../worker/app.ts';
import { CSP } from '../../worker/middleware/headers.ts';
import { call } from '../support/app.ts';
import { makeActivity, makeException, makeOffer, makePlace, makeProperty, makeStaff, makeZone } from '../support/fixtures.ts';

// Anonymous-surface test (05 §4 rule 7): every route, no cookie, field names against an allow-list.

const bilingual = [...PUBLIC_FIELDS.bilingual];
const allow: Record<string, string[]> = {
  'GET /api/hosts/properties': [...PUBLIC_FIELDS.propertyChoice, ...bilingual],
  'GET /api/p/:slug/config': [...PUBLIC_FIELDS.property, ...PUBLIC_FIELDS.features, ...bilingual],
  'GET /api/p/:slug/activities': [...PUBLIC_FIELDS.activity, ...bilingual],
  'GET /api/p/:slug/places': [...PUBLIC_FIELDS.place, ...bilingual],
  'GET /api/p/:slug/offers': [...PUBLIC_FIELDS.offer, ...bilingual],
  'POST /api/p/:slug/events': [],
};

// Person-level staff routes, called with no cookie: the status and the only field names they may return.
// Every route under /api/staff/p/ must answer 401 with just { error }: that rule needs no entry, so a new
// property-scoped staff route is covered the moment it exists.
const challengeKeys = ['challengeId', 'options', 'rpId', 'challenge', 'allowCredentials', 'timeout', 'userVerification', 'extensions'];
const staffAuth: Record<string, { status: number; keys: string[] }> = {
  'POST /api/staff/auth/login/options': { status: 200, keys: challengeKeys },
  'POST /api/staff/auth/login/verify': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/link/inspect': { status: 400, keys: ['error'] },
  'POST /api/staff/auth/link/accept': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/register/options': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/register/verify': { status: 400, keys: ['error'] },
  'GET /api/staff/auth/me': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/logout': { status: 200, keys: ['ok'] },
  'POST /api/staff/auth/logout-all': { status: 401, keys: ['error'] },
  'GET /api/staff/auth/sessions': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/sessions/revoke': { status: 401, keys: ['error'] },
  'GET /api/staff/auth/credentials': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/credentials/revoke': { status: 401, keys: ['error'] },
  'POST /api/staff/auth/credentials/rename': { status: 401, keys: ['error'] },
};
const isStaffProperty = (key: string) => key.split(' ')[1]?.startsWith('/api/staff/p/') ?? false;

function fieldNames(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) fieldNames(v, into);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      fieldNames(v, into);
    }
  }
  return into;
}

describe('anonymous surface', () => {
  it('every registered route has an allow-list (a new route fails this test until one is written)', () => {
    const routes = createApp().routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${r.path}`);
    const known = [...Object.keys(allow), ...Object.keys(staffAuth)];
    expect(routes.filter((r) => !isStaffProperty(r)).sort()).toEqual(known.sort());
    expect(routes.filter(isStaffProperty).length).toBeGreaterThan(0);
  });

  it('with no cookie, every route returns only allow-listed field names, and no id of a property', async () => {
    const a = await makeProperty(env.DB, 'surf-a', { host: 'surf.test' });
    const b = await makeProperty(env.DB, 'surf-b', { host: 'surf.test' });
    const zone = await makeZone(env.DB, a.id);
    const act = await makeActivity(env.DB, a.id, [a.id, b.id], 'Shared', zone);
    await makeException(env.DB, act, a.id, '2026-11-02');
    await makePlace(env.DB, a.id);
    await makeOffer(env.DB, a.id, Math.floor(Date.now() / 1000));
    await makeStaff(env.DB, 'surf@x.test', [{ propertyId: a.id, role: 'admin' }]);
    await env.DB.prepare('UPDATE places SET is_placeholder = 1, phone = ?1 WHERE property_id = ?2').bind('555', a.id).run();

    const seen: Record<string, Set<string>> = {};
    const record = async (key: string, res: Response) => {
      const text = await res.text();
      if (text) seen[key] = fieldNames(JSON.parse(text));
      for (const id of [a.id, b.id]) expect(text, key).not.toContain(id);
      return res;
    };
    await record('GET /api/hosts/properties', await call('/api/hosts/properties', { host: 'surf.test' }));
    for (const [path, key] of [
      ['config', 'GET /api/p/:slug/config'],
      ['activities', 'GET /api/p/:slug/activities'],
      ['places', 'GET /api/p/:slug/places'],
      ['offers', 'GET /api/p/:slug/offers'],
    ] as const) {
      const res = await record(key, await call(`/api/p/surf-a/${path}`, { host: 'surf.test' }));
      expect(res.status, key).toBe(200);
    }
    expect((await record('POST /api/p/:slug/events', await call('/api/p/surf-a/events', { host: 'surf.test', method: 'POST', body: { event: 'opened_whats_on' } }))).status).toBe(204);
    // Staff routes with no cookie: person-level ones by their table, property-scoped ones all 401 { error }.
    for (const route of createApp().routes.filter((r) => r.method !== 'ALL')) {
      const key = ` `;
      const path = route.path.replace(':slug', 'surf-a').replace(':id', 'a'.repeat(32));
      if (!isStaffProperty(key) && !(key in staffAuth)) continue;
      const res = await record(key, await call(path, { host: 'surf.test', method: route.method, body: route.method === 'POST' ? {} : undefined }));
      const want = staffAuth[key] ?? { status: 401, keys: ['error'] };
      expect(res.status, key).toBe(want.status);
      allow[key] = want.keys;
    }

    for (const [key, names] of Object.entries(seen)) {
      const extra = [...names].filter((n) => !(allow[key] ?? []).includes(n));
      expect(extra, `${key} returned fields outside its allow-list`).toEqual([]);
    }
    // And the interesting rows really were returned (the test is not passing on empty bodies).
    expect(seen['GET /api/p/:slug/activities']?.has('cancelledDates')).toBe(true);
    expect(seen['GET /api/p/:slug/places']?.has('phone')).toBe(true);
  });

  it('forbidden fields never appear, on any route, under any name', async () => {
    const a = await makeProperty(env.DB, 'surf-f', { host: 'surf-f.test' });
    await makeActivity(env.DB, a.id, [a.id], 'X');
    await makePlace(env.DB, a.id);
    const forbidden = ['property_id', 'propertyId', 'owner', 'ownerPropertyId', 'owner_property_id', 'staff', 'staffId', 'actor', 'session', 'sessionId', 'email', 'token', 'tokenHash'];
    for (const path of ['/api/hosts/properties', '/api/p/surf-f/config', '/api/p/surf-f/activities', '/api/p/surf-f/places', '/api/p/surf-f/offers']) {
      const names = fieldNames(await (await call(path, { host: 'surf-f.test' })).json());
      for (const f of forbidden) expect(names.has(f), `${path} has ${f}`).toBe(false);
    }
  });

  it('the catch-all answers a flat JSON 404 and reveals nothing', async () => {
    const res = await call('/api/definitely-not-a-route', { host: 'localhost' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('security headers (05 §14)', () => {
  it('every kind of response carries the exact CSP and companions', async () => {
    const a = await makeProperty(env.DB, 'hdr', { host: 'hdr.test' });
    for (const res of [
      await call('/', { host: a.host }),
      await call('/api/hosts/properties', { host: a.host }),
      await call('/api/nope', { host: a.host }),
      await call(`/api/p/${a.slug}/config`, { host: a.host }),
    ]) {
      expect(res.headers.get('Content-Security-Policy')).toBe(CSP);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(res.headers.get('Permissions-Policy')).toContain('geolocation=(self)');
    }
    expect(CSP).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
  });
});

describe('staff property routes (05 §4 rules 1 and 8), with an injected sign-in', () => {
  it('naming a property gives no access; the role is read per request', async () => {
    const a = await makeProperty(env.DB, 'stf-a', { host: 'stf.test' });
    const b = await makeProperty(env.DB, 'stf-b', { host: 'stf.test' });
    const person = await makeStaff(env.DB, 'stf@x.test', [{ propertyId: a.id, role: 'editor' }]);
    const app = createApp({ staffResolver: async () => ({ staffUserId: person }) });
    const own = await call('/api/staff/p/stf-a/me', { host: 'stf.test', app });
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ role: 'editor', property: { slug: 'stf-a' } });
    const other = await call('/api/staff/p/stf-b/me', { host: 'stf.test', app });
    expect(other.status).toBe(404); // the person exists but has no role at B
    // Role changes take effect at once: no long-lived token.
    await env.DB.prepare("UPDATE staff_memberships SET role = 'admin' WHERE staff_user_id = ?1").bind(person).run();
    expect(await (await call('/api/staff/p/stf-a/me', { host: 'stf.test', app })).json()).toMatchObject({ role: 'admin' });
    await env.DB.prepare('DELETE FROM staff_memberships WHERE staff_user_id = ?1').bind(person).run();
    expect((await call('/api/staff/p/stf-a/me', { host: 'stf.test', app })).status).toBe(404);
    expect(b.id).not.toBe(a.id);
  });

  it('no sign-in configured: 401 for everyone', async () => {
    const a = await makeProperty(env.DB, 'stf-none', { host: 'stf-none.test' });
    expect((await call(`/api/staff/p/${a.slug}/me`, { host: a.host })).status).toBe(401);
  });
});
