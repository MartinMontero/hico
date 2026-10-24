import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';
import { slugSchema } from '../../shared/schemas.ts';
import { hosts, staff } from '../repositories/index.ts';
import { createTenantContext, type StaffContext, type TenantContext } from '../tenant.ts';

export type AppVariables = {
  tenant: TenantContext;
  staff: StaffContext;
};
export type AppEnv = { Bindings: Env; Variables: AppVariables };

/** The Host header, lowercased, without a port. */
export function requestHost(request: Request): string {
  return new URL(request.url).hostname.toLowerCase();
}

/**
 * Public content (D-24). The slug in /api/p/:slug counts only if it names a property in THIS
 * hostname's own list in property_hosts. An unknown slug and a slug that is not on the host
 * get the same flat 404, so the response does not reveal which properties exist.
 */
export const publicTenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const parsed = v.safeParse(slugSchema, c.req.param('slug'));
  const notFound = () => c.json({ error: 'not_found' }, 404);
  if (!parsed.success) return notFound();
  const listed = await hosts.listPropertiesForHost(c.env.DB, requestHost(c.req.raw));
  const match = listed.find((p) => p.slug === parsed.output);
  if (!match) return notFound();
  c.set('tenant', createTenantContext(c.env.DB, match));
  return next();
};

/** Who is this staff member? Phase 1b supplies the real sign-in; Phase 1 has none. */
export type StaffResolver = (c: { req: { raw: Request }; env: Env }) => Promise<{ staffUserId: string } | null>;

/**
 * Staff routes (05 §4 rules 1 and 8): the property is named in the path, and the role is read
 * from the database on every request. Naming a property gives no access by itself.
 */
export function staffTenant(resolve: StaffResolver | undefined): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const identity = resolve ? await resolve(c) : null;
    if (!identity) return c.json({ error: 'unauthorized' }, 401);
    const parsed = v.safeParse(slugSchema, c.req.param('slug'));
    if (!parsed.success) return c.json({ error: 'not_found' }, 404);
    const access = await staff.roleAtSlug(c.env.DB, identity.staffUserId, parsed.output);
    if (!access) return c.json({ error: 'not_found' }, 404);
    const tenant = createTenantContext(c.env.DB, access);
    c.set('tenant', tenant);
    c.set('staff', { tenant, staffUserId: identity.staffUserId, role: access.role });
    return next();
  };
}
