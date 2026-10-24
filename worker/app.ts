import { Hono } from 'hono';
import * as v from 'valibot';
import { eventBodySchema } from '../shared/schemas.ts';
import { previewGate } from './preview-gate/index.ts';
import { readOnlySwitch, writeGuards } from './middleware/guards.ts';
import { requestLog, securityHeaders } from './middleware/headers.ts';
import { publicTenant, requestHost, staffTenant, type AppEnv, type StaffResolver } from './middleware/tenant.ts';
import { activities, events, hosts, offers, places, properties } from './repositories/index.ts';
import {
  projectActivity,
  projectOffer,
  projectPlace,
  projectProperty,
  projectPropertyChoice,
} from './projections.ts';

export interface AppOptions {
  /** Phase 1b supplies the real staff sign-in; until then there is none and staff routes answer 401. */
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

  // Staff routes keep the 05 form /staff/p/<slug>/...; the role is checked on every request.
  const staffRoutes = new Hono<AppEnv>();
  staffRoutes.use('*', staffTenant(options.staffResolver));
  staffRoutes.get('/me', (c) => c.json({ role: c.get('staff').role }));
  app.route('/staff/p/:slug', staffRoutes);

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  // Everything else is the front end (SPA fallback is configured on the assets binding).
  app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}
