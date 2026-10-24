import { Hono, type MiddlewareHandler } from 'hono';
import * as v from 'valibot';
import { idSchema, inviteSchema, roleChangeSchema } from '../../shared/staff-schemas.ts';
import type { AppEnv } from '../middleware/tenant.ts';
import { audit, credentials, people, sessions, tokens } from '../repositories/index.ts';
import { randomToken, sha256Hex } from '../security.ts';

const LINK_SECONDS = 30 * 60; // a handed-over link works for 30 minutes, once (D-28)

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) =>
  c.get('staff').role === 'admin' ? next() : c.json({ error: 'forbidden' }, 403);

/** Admin-only people management for one property: invite, role, remove, recovery link, revoke sessions. */
export function createStaffPeopleRoutes(now: () => number): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.use('/people', requireAdmin);
  r.use('/people/*', requireAdmin);

  r.get('/people', async (c) => {
    const rows = await people.listForProperty(c.get('tenant'));
    return c.json(
      rows.map((p) => ({ id: p.id, displayName: p.displayName, email: p.email, role: p.role, passkeys: p.passkeys, lastSignInAt: p.lastSignInAt })),
    );
  });

  // Hand a one-time link to a person (D-28). The raw token is returned once and never stored.
  r.post('/people/invite', async (c) => {
    const body = v.safeParse(inviteSchema, await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request' }, 400);
    const { tenant, staffUserId } = c.get('staff');
    const existing = await people.findUserByEmail(tenant.db, body.output.email);
    if (existing && (await people.roleOf(tenant, existing.id))) return c.json({ error: 'already_member' }, 409);
    const token = randomToken();
    await tokens.createInvite(
      tenant.db,
      { hash: await sha256Hex(token), email: body.output.email, displayName: body.output.displayName, propertyId: tenant.propertyId, role: body.output.role, createdBy: staffUserId },
      now(),
      LINK_SECONDS,
    );
    await audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action: 'staff.invite.created', targetType: 'invite', targetId: null }, now());
    return c.json({ token, expiresAt: now() + LINK_SECONDS, existingUser: existing !== null });
  });

  r.post('/people/:id/role', async (c) => {
    const id = v.safeParse(idSchema, c.req.param('id'));
    const body = v.safeParse(roleChangeSchema, await c.req.json().catch(() => null));
    if (!id.success || !body.success) return c.json({ error: 'bad_request' }, 400);
    const { tenant, staffUserId } = c.get('staff');
    const result = await people.setRole(tenant, id.output, body.output.role);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'last_admin') return c.json({ error: 'last_admin' }, 409);
    await audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action: 'staff.role.changed', targetType: 'staff', targetId: id.output }, now());
    return c.json({ ok: true });
  });

  r.post('/people/:id/remove', async (c) => {
    const id = v.safeParse(idSchema, c.req.param('id'));
    if (!id.success) return c.json({ error: 'bad_request' }, 400);
    const { tenant, staffUserId } = c.get('staff');
    const result = await people.removeMember(tenant, id.output);
    if (result === 'missing') return c.json({ error: 'not_found' }, 404);
    if (result === 'last_admin') return c.json({ error: 'last_admin' }, 409);
    await audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action: 'staff.member.removed', targetType: 'staff', targetId: id.output }, now());
    return c.json({ ok: true });
  });

  // A recovery link replaces the person's access everywhere, so the issuer must be an admin of every
  // property the person belongs to (people.canIssueRecovery). Otherwise: the operator.
  r.post('/people/:id/recovery', async (c) => {
    const id = v.safeParse(idSchema, c.req.param('id'));
    if (!id.success) return c.json({ error: 'bad_request' }, 400);
    const { tenant, staffUserId } = c.get('staff');
    if (!(await people.roleOf(tenant, id.output))) return c.json({ error: 'not_found' }, 404);
    if (!(await people.canIssueRecovery(tenant.db, staffUserId, id.output))) return c.json({ error: 'needs_operator' }, 403);
    const target = await people.findUserById(tenant.db, id.output);
    if (!target || target.disabled) return c.json({ error: 'not_found' }, 404);
    const token = randomToken();
    await tokens.createRecovery(tenant.db, { hash: await sha256Hex(token), email: target.email, displayName: target.displayName, staffUserId: target.id, createdBy: staffUserId }, now(), LINK_SECONDS);
    await audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action: 'staff.recovery.issued', targetType: 'staff', targetId: id.output }, now());
    return c.json({ token, expiresAt: now() + LINK_SECONDS });
  });

  r.post('/people/:id/revoke-sessions', async (c) => {
    const id = v.safeParse(idSchema, c.req.param('id'));
    if (!id.success) return c.json({ error: 'bad_request' }, 400);
    const { tenant, staffUserId } = c.get('staff');
    if (!(await people.roleOf(tenant, id.output))) return c.json({ error: 'not_found' }, 404);
    if (!(await people.canIssueRecovery(tenant.db, staffUserId, id.output))) return c.json({ error: 'needs_operator' }, 403);
    const n = await sessions.revokeAllFor(tenant.db, id.output, now());
    await audit.append(tenant, { actorKind: 'staff', actorStaffId: staffUserId, action: 'staff.sessions.revoked', targetType: 'staff', targetId: id.output }, now());
    return c.json({ revoked: n, passkeys: await credentials.countActive(tenant.db, id.output) });
  });

  return r;
}
