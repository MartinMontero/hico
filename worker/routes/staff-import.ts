import { Hono } from 'hono';
import * as v from 'valibot';
import { importBodySchema, type ImportDocument, type ImportIssue, type ImportReport } from '../../shared/import-schemas.ts';
import type { ActivityInput, OfferInput } from '../../shared/staff-content-schemas.ts';
import { dayBounds, localToEpoch } from '../../shared/time.ts';
import type { AppEnv } from '../middleware/tenant.ts';
import { activities, imports, offers, people, places, zones } from '../repositories/index.ts';
import type { ImportWrite } from '../repositories/imports.ts';
import type { ActivityWrite } from '../repositories/activities.ts';
import type { TenantContext } from '../tenant.ts';
import { requireAdmin } from './staff-people.ts';

const norm = (value: string) => value.trim().toLocaleLowerCase('en');
type ItemFor<F extends ImportDocument['format']> = Extract<ImportDocument, { format: F }>['items'][number];

function activityWrite(input: Omit<ActivityInput, 'zoneId'>, zoneId: string | null, timezone: string): ActivityWrite | 'end_before_start' {
  const base = {
    titleEn: input.titleEn, titleFr: input.titleFr, descriptionEn: input.descriptionEn, descriptionFr: input.descriptionFr,
    changeNoteEn: input.changeNoteEn, changeNoteFr: input.changeNoteFr, category: input.category, zoneId,
    hostLabel: input.hostLabel, capacity: input.capacity,
  };
  const s = input.schedule;
  if (s.kind === 'weekly') {
    if (s.endLocal !== null && s.endLocal <= s.startLocal) return 'end_before_start';
    return { ...base, weekday: s.weekday, startLocal: s.startLocal, endLocal: s.endLocal, startsAt: null, endsAt: null };
  }
  const startsAt = localToEpoch(s.date, s.startLocal, timezone);
  const endsAt = s.endLocal !== null ? localToEpoch(s.date, s.endLocal, timezone) : null;
  if (endsAt !== null && endsAt <= startsAt) return 'end_before_start';
  return { ...base, weekday: null, startLocal: null, endLocal: null, startsAt, endsAt };
}

function activityKey(title: string, value: ActivityWrite): string {
  const schedule = value.weekday !== null
    ? `weekly:${value.weekday}:${value.startLocal}:${value.endLocal ?? ''}`
    : `one_off:${value.startsAt}:${value.endsAt ?? ''}`;
  return `${norm(title)}|${schedule}`;
}

function offerWrite(input: OfferInput, timezone: string) {
  return {
    partnerName: input.partnerName, termsEn: input.termsEn, termsFr: input.termsFr,
    validFrom: input.validFrom ? dayBounds(input.validFrom, timezone).start : null,
    validTo: input.validTo ? dayBounds(input.validTo, timezone).end : null,
    requiresMembership: input.requiresMembership, howWeKnowEn: input.howWeKnowEn, howWeKnowFr: input.howWeKnowFr,
  };
}

async function confirmationFor(document: ImportDocument, propertyId: string, staffUserId: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ propertyId, staffUserId, document }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build and check a plan without writing. Apply calls this again, so a dry run is never trusted as current state. */
async function plan(document: ImportDocument, tenant: TenantContext) {
  const issues: ImportIssue[] = [];
  const writes: ImportWrite[] = [];
  const keys = new Set<string>();
  const contentKeys = new Set<string>();
  const existingKeys = new Set<string>();

  if (document.format === 'hico-zones-v1') {
    for (const z of await zones.list(tenant)) existingKeys.add(norm(z.labelEn));
  } else if (document.format === 'hico-places-v1') {
    for (const p of await places.listForStaff(tenant)) existingKeys.add(`${p.category}|${norm(p.name)}`);
  } else if (document.format === 'hico-offers-v1') {
    for (const o of await offers.listForStaff(tenant)) existingKeys.add(`${norm(o.partner_name)}|${norm(o.terms_en)}`);
  } else {
    for (const a of await activities.listForStaff(tenant)) {
      if (a.row.owner_id !== tenant.propertyId) continue;
      existingKeys.add(activityKey(a.row.title_en, {
        titleEn: a.row.title_en, titleFr: '', descriptionEn: '', descriptionFr: '', changeNoteEn: '', changeNoteFr: '',
        category: a.row.category, zoneId: null, hostLabel: '', capacity: null, weekday: a.row.weekday,
        startLocal: a.row.start_local, endLocal: a.row.end_local, startsAt: a.row.starts_at, endsAt: a.row.ends_at,
      }));
    }
  }
  const ownZones = document.format === 'hico-activities-v1' ? await zones.list(tenant) : [];

  for (const [index, item] of document.items.entries()) {
    if (keys.has(item.clientKey)) issues.push({ index, clientKey: item.clientKey, code: 'duplicate_client_key' });
    keys.add(item.clientKey);
    let contentKey = item.clientKey;

    if (document.format === 'hico-zones-v1') {
      const zone = item as ItemFor<'hico-zones-v1'>;
      contentKey = norm(zone.labelEn);
      writes.push({ kind: 'zone', clientKey: zone.clientKey, value: { labelEn: zone.labelEn, labelFr: zone.labelFr, ring: zone.ring } });
    } else if (document.format === 'hico-places-v1') {
      const place = item as ItemFor<'hico-places-v1'>;
      contentKey = `${place.category}|${norm(place.name)}`;
      writes.push({ kind: 'place', clientKey: place.clientKey, value: {
        category: place.category, name: place.name, staffPick: place.staffPick, noteEn: place.noteEn, noteFr: place.noteFr,
        walkTimeEn: place.walkTimeEn, walkTimeFr: place.walkTimeFr, hoursEn: place.hoursEn, hoursFr: place.hoursFr,
        phone: place.phone, mapsAddress: place.mapsAddress,
      } });
    } else if (document.format === 'hico-offers-v1') {
      const offer = item as ItemFor<'hico-offers-v1'>;
      contentKey = `${norm(offer.partnerName)}|${norm(offer.termsEn)}`;
      if (offer.validFrom !== null && offer.validTo !== null && offer.validTo < offer.validFrom) issues.push({ index, clientKey: offer.clientKey, code: 'ends_before_start' });
      writes.push({ kind: 'offer', clientKey: offer.clientKey, value: offerWrite(offer, tenant.timezone) });
    } else {
      const activity = item as ItemFor<'hico-activities-v1'>;
      if (activity.offeredAt.some((slug) => slug !== tenant.slug)) issues.push({ index, clientKey: activity.clientKey, code: 'off_property_share' });
      const zone = activity.zoneLabelEn === '' ? null : ownZones.find((z) => norm(z.labelEn) === norm(activity.zoneLabelEn));
      if (activity.zoneLabelEn !== '' && !zone) issues.push({ index, clientKey: activity.clientKey, code: 'unknown_zone' });
      const write = activityWrite(activity, zone?.id ?? null, tenant.timezone);
      if (write === 'end_before_start') {
        issues.push({ index, clientKey: activity.clientKey, code: 'end_before_start' });
      } else {
        contentKey = activityKey(activity.titleEn, write);
        writes.push({ kind: 'activity', clientKey: activity.clientKey, value: write });
      }
    }
    if (existingKeys.has(contentKey) || contentKeys.has(contentKey)) issues.push({ index, clientKey: item.clientKey, code: 'duplicate_content' });
    contentKeys.add(contentKey);
  }
  return { issues, writes };
}

export function createStaffImportRoutes(now: () => number): Hono<AppEnv> {
  const r = new Hono<AppEnv>();
  r.post('/import', requireAdmin, async (c) => {
    const parsed = v.safeParse(importBodySchema, await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    const input = parsed.output;
    const { tenant, staffUserId } = c.get('staff');
    if (input.mode === 'apply' && !input.confirmation) return c.json({ error: 'confirmation_required' }, 400);
    const prepared = await plan(input.document, tenant);
    const report: ImportReport = { mode: input.mode, format: input.document.format, valid: prepared.issues.length === 0, itemCount: input.document.items.length, issues: prepared.issues };
    if (!report.valid) return c.json(report, input.mode === 'dry_run' ? 200 : 400);
    const confirmation = await confirmationFor(input.document, tenant.propertyId, staffUserId);
    if (input.mode === 'dry_run') return c.json({ ...report, confirmation });
    if (input.confirmation !== confirmation) return c.json({ error: 'confirmation_mismatch' }, 409);
    const person = await people.findUserById(tenant.db, staffUserId);
    const verifiedBy = (person?.displayName || 'Staff').slice(0, 80);
    await imports.apply(tenant, prepared.writes, staffUserId, verifiedBy, now());
    return c.json({ ...report, imported: prepared.writes.length });
  });
  return r;
}
