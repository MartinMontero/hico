import { Hono } from 'hono';
import * as v from 'valibot';
import { eventBodySchema } from '../shared/schemas.ts';
import { previewGate } from './preview-gate/index.ts';
import { readOnlySwitch, writeGuards } from './middleware/guards.ts';
import { requestLog, securityHeaders } from './middleware/headers.ts';
import { cookieResolver } from './middleware/staff-session.ts';
import { publicTenant, requestHost, staffTenant, type AppEnv, type StaffResolver } from './middleware/tenant.ts';
import { createStaffAuthRoutes } from './routes/staff-auth.ts';
import { createStaffPeopleRoutes } from './routes/staff-people.ts';
import { activities, events, hosts, offers, places, properties } from './repositories/index.ts';
import {
  projectActivity,
  projectOffer,
  projectPlace,
  projectProperty,
  projectPropertyChoice,
} from './projections.ts';

export interface AppOptions {
  /** Replaces the session-cookie sign-in. Tests inject one; production uses the cookie. */
  staffResolver?: StaffResolver;
  /** Test hook for the clock (epoch seconds). */
  now?: () => number;
}

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const app = new Hono<AppEnv>();

  app.use('*', requestLog);
  app.use('*', securityHeaders);
  app.use('*', previewGate); // first real gate: covers /api/* and assets alike
  app.use('/api/*', readOnlySwitch);
  app.use('/api/*', writeGuards);

  // The hostel choice for hosts that list several properties (D-24). Public fields only.
  app.get('/api/hosts/properties', async (c) => {
    const listed = await hosts.listPropertiesForHost(c.env.DB, requestHost(c.req.raw));
    return c.json(listed.map(projectPropertyChoice));
  });

  const pub = new Hono<AppEnv>();
  pub.use('*', publicTenant);

  pub.get('/config', async (c) => {
    const tenant = c.get('tenant');
    const row = await properties.getOwn(tenant);
    if (!row) return c.json({ error: 'not_found' }, 404);
    return c.json(projectProperty(row, await properties.listFeatures(tenant)));
  });

  pub.get('/activities', async (c) => {
    const rows = await activities.listVisible(c.get('tenant'));
    return c.json(rows.map(projectActivity));
  });

  pub.get('/places', async (c) => {
    const rows = await places.list(c.get('tenant'));
    return c.json(rows.map(projectPlace));
  });

  pub.get('/offers', async (c) => {
    const rows = await offers.listShown(c.get('tenant'), now());
    return c.json(rows.map(projectOffer));
  });

  pub.post('/events', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'bad_request' }, 400);
    }
    const parsed = v.safeParse(eventBodySchema, body);
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    const day = new Date(now() * 1000).toISOString().slice(0, 10);
    await events.increment(c.get('tenant'), day, parsed.output.event);
    return c.body(null, 204);
  });

  app.route('/api/p/:slug', pub);

  // Staff (D-26). Person-level auth lives at /api/staff/auth; everything about one property is under
  // /api/staff/p/<slug>/..., where the role is read from the database on every request (05 §4 rules 1 and 8).
  app.route('/api/staff/auth', createStaffAuthRoutes(now));

  const staffApi = new Hono<AppEnv>();
  staffApi.use('*', staffTenant(options.staffResolver ?? cookieResolver(now)));
  staffApi.get('/me', async (c) => {
    const s = c.get('staff');
    const row = await properties.getOwn(s.tenant);
    return c.json({ role: s.role, property: row ? { slug: row.slug, name: { en: row.nameEn, fr: row.nameFr }, timezone: row.timezone } : null });
  });
  staffApi.route('/', createStaffPeopleRoutes(now));
  app.route('/api/staff/p/:slug', staffApi);
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  // Everything else is the front end (SPA fallback is configured on the assets binding).
  app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}
