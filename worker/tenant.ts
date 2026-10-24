// The request context that every repository function takes first. It can only be built by
// the middleware (static test: tests/node/static.test.ts), after the property was found
// server-side (host lookup plus listed slug, a verified session, or a staff role check).
// It is never built from a body, a query string, a client header or a client id.

declare const tenantBrand: unique symbol;

export interface TenantContext {
  readonly [tenantBrand]: true;
  readonly db: D1Database;
  readonly propertyId: string;
  readonly slug: string;
  readonly timezone: string;
}

export interface TenantInit {
  propertyId: string;
  slug: string;
  timezone: string;
}

export function createTenantContext(db: D1Database, init: TenantInit): TenantContext {
  // The brand is a type-level marker only; there is no runtime property for it.
  return { db, propertyId: init.propertyId, slug: init.slug, timezone: init.timezone } as TenantContext;
}

export type StaffRole = 'editor' | 'admin';

export interface StaffContext {
  readonly tenant: TenantContext;
  readonly staffUserId: string;
  readonly role: StaffRole;
}
