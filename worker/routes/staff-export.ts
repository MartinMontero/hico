import { Hono } from 'hono';
import * as v from 'valibot';
import { epochToLocal } from '../../shared/time.ts';
import { buildContentHealth } from '../../shared/content-health.ts';
import { LIMITS } from '../../shared/limits.ts';
import { projectAuditEntry, projectStaffActivity, projectStaffCode, projectStaffOffer, projectStaffPlace, projectStaffZone } from '../projections-staff.ts';
import type { AppEnv } from '../middleware/tenant.ts';
import { activities, audit, codes, events, offers, places, properties, zones } from '../repositories/index.ts';
import { requireAdmin } from './staff-people.ts';

const auditQuery = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/))),
  before: v.optional(v.pipe(v.string(), v.regex(/^\d{1,12}$/))),
  action: v.optional(v.pipe(v.string(), v.maxLength(LIMITS.action), v.regex(/^[a-z_.]+$/))),
});

/** The audit log (read-only) and the content export. Both admin only. */
export function createStaffExportRoutes(now: () => number): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.get('/audit', requireAdmin, async (c) => {
    const q = v.safeParse(auditQuery, c.req.query());
    if (!q.success) return c.json({ error: 'bad_request' }, 400);
    const rows = await audit.list(c.get('tenant'), { limit: Number(q.output.limit ?? 50), before: q.output.before ? Number(q.output.before) : undefined, action: q.output.action });
    return c.json(rows.map(projectAuditEntry));
  });

  // Aggregate counts only: no guest identifier, device detail or request metadata is returned.
  r.get('/counts', requireAdmin, async (c) => {
    const query = c.req.query();
    if (Object.keys(query).some((key) => key !== 'day')) return c.json({ error: 'bad_request' }, 400);
    const day = query.day;
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return c.json({ error: 'bad_request' }, 400);
    return c.json(await events.listFor(c.get('tenant'), day));
  });

  // Actionable content health, built from the same tenant-scoped repository reads as the staff editors.
  r.get('/content-health', requireAdmin, async (c) => {
    const t = c.get('tenant');
    const [activityRows, placeRows, offerRows, zoneRows] = await Promise.all([
      activities.listForStaff(t), places.listForStaff(t), offers.listForStaff(t), zones.list(t),
    ]);
    const stamped = (row: { id: string; verified_on: number | null; is_placeholder: number }, title: string) => ({
      id: row.id, title, verifiedOn: row.verified_on, isPlaceholder: row.is_placeholder,
    });
    return c.json(buildContentHealth({
      activities: activityRows.map(({ row }) => stamped(row, row.title_en)),
      places: placeRows.map((row) => stamped(row, row.name)),
      offers: offerRows.map((row) => stamped(row, row.partner_name)),
      zones: zoneRows.length,
    }, now()));
  });

  // One file of the property's own content, for its own records. No staff list, no emails, no other property's rows.
  r.post('/export', requireAdmin, async (c) => {
    const s = c.get('staff');
    const t = s.tenant;
    const when = now();
    const [property, features, zoneRows, activityRows, placeRows, offerRows, codeRows] = await Promise.all([
      properties.getOwn(t), properties.listFeatures(t), zones.list(t), activities.listForStaff(t), places.listForStaff(t), offers.listForStaff(t), codes.list(t),
    ]);
    await audit.append(t, { actorKind: 'staff', actorStaffId: s.staffUserId, action: 'staff.export', targetType: 'property', targetId: null }, when);
    const date = epochToLocal(when, t.timezone).date;
    const content = {
      exportedAt: when,
      property: property ? { slug: property.slug, name: { en: property.nameEn, fr: property.nameFr }, timezone: property.timezone, languages: property.languages.split(',') } : null,
      features,
      zones: zoneRows.map(projectStaffZone),
      // Activities this property owns or offers; a shared one lists the properties that show it, by public name.
      activities: activityRows.map((a) => projectStaffActivity(a, { propertyId: t.propertyId, role: s.role }, when)),
      places: placeRows.map((p) => projectStaffPlace(p, when)),
      offers: offerRows.map((o) => projectStaffOffer(o, t.timezone, when)),
      qrLabels: codeRows.map(projectStaffCode),
    };
    return new Response(JSON.stringify(content, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${t.slug}-export-${date}.json"`, 'Cache-Control': 'private, no-store' },
    });
  });

  return r;
}
