import type { StaffActivity, StaffAuditEntry, StaffCode, StaffOffer, StaffPlace, StaffZone } from '../shared/types.ts';
import { pastCheckLimit, type CheckKind } from '../shared/check-limits.ts';
import { epochToLocal } from '../shared/time.ts';
import type { StaffActivityFull } from './repositories/activities.ts';
import type { AuditRow } from './repositories/audit.ts';
import type { CodeRow } from './repositories/codes.ts';
import type { StaffOfferRow } from './repositories/offers.ts';
import type { StaffPlaceRow } from './repositories/places.ts';
import type { ZoneRow } from './repositories/zones.ts';

// Named staff projections: exactly the fields staff may see, listed one by one. Never sent to a guest, and
// never built from another property's rows (the repositories only return this property's).

// The limits are declared once, in shared\check-limits.ts (assumed demo values, D-33).
const overdue = (verifiedOn: number | null, now: number, kind: CheckKind): 'ok' | 'overdue' => (pastCheckLimit(verifiedOn, now, kind) ? 'overdue' : 'ok');

export function projectStaffActivity(full: StaffActivityFull, who: { propertyId: string; role: 'editor' | 'admin' }, now: number): StaffActivity {
  const r = full.row;
  const isOwner = r.owner_id === who.propertyId;
  const schedule: StaffActivity['schedule'] =
    r.weekday !== null && r.start_local !== null
      ? { kind: 'weekly', weekday: r.weekday, startLocal: r.start_local, endLocal: r.end_local }
      : (() => {
          const start = epochToLocal(r.starts_at ?? 0, r.timezone);
          return { kind: 'one_off' as const, date: start.date, startLocal: start.time, endLocal: r.ends_at !== null ? epochToLocal(r.ends_at, r.timezone).time : null };
        })();
  return {
    id: r.id,
    title: { en: r.title_en, fr: r.title_fr },
    description: { en: r.description_en, fr: r.description_fr },
    changeNote: { en: r.change_note_en, fr: r.change_note_fr },
    category: r.category,
    zoneId: r.zone_id,
    zone: r.zone_en !== null && r.zone_fr !== null ? { en: r.zone_en, fr: r.zone_fr } : null,
    hostLabel: r.host_label,
    capacity: r.capacity,
    status: r.status,
    schedule,
    timezone: r.timezone,
    cancelledDates: full.cancelledDates,
    isOwner,
    offeredAt: full.offeredAt.map((o) => ({ slug: o.slug, name: { en: o.nameEn, fr: o.nameFr } })),
    canChangeList: isOwner && who.role === 'admin',
    verifiedOn: r.verified_on,
    verifiedBy: r.verified_by,
    check: overdue(r.verified_on, now, 'board'),
    isPlaceholder: r.is_placeholder === 1,
    version: r.version,
  };
}

export function projectStaffPlace(r: StaffPlaceRow, now: number): StaffPlace {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    staffPick: r.staff_pick === 1,
    note: { en: r.note_en, fr: r.note_fr },
    walkTime: { en: r.walk_time_en, fr: r.walk_time_fr },
    hours: { en: r.hours_en, fr: r.hours_fr },
    phone: r.phone,
    mapsAddress: r.maps_address,
    verifiedOn: r.verified_on,
    verifiedBy: r.verified_by,
    check: overdue(r.verified_on, now, 'places'),
    isPlaceholder: r.is_placeholder === 1,
    version: r.version,
  };
}

export function projectStaffOffer(r: StaffOfferRow, timezone: string, now: number): StaffOffer {
  const guestState: StaffOffer['guestState'] =
    r.valid_to !== null && r.valid_to < now ? 'expired' : r.valid_from !== null && r.valid_from > now ? 'not_started' : overdue(r.verified_on, now, 'offers') === 'overdue' ? 'unchecked' : 'shown';
  return {
    id: r.id,
    partnerName: r.partner_name,
    terms: { en: r.terms_en, fr: r.terms_fr },
    validFrom: r.valid_from !== null ? epochToLocal(r.valid_from, timezone).date : null,
    validTo: r.valid_to !== null ? epochToLocal(r.valid_to, timezone).date : null,
    requiresMembership: r.requires_membership === 1,
    howWeKnow: { en: r.how_we_know_en, fr: r.how_we_know_fr },
    verifiedOn: r.verified_on,
    verifiedBy: r.verified_by,
    guestState,
    isPlaceholder: r.is_placeholder === 1,
    version: r.version,
  };
}

export function projectStaffZone(z: ZoneRow): StaffZone {
  return { id: z.id, label: { en: z.labelEn, fr: z.labelFr }, ring: z.ring, inUse: z.inUse, version: z.version };
}

export function projectStaffCode(c: CodeRow): StaffCode {
  return { id: c.id, label: c.label, createdAt: c.createdAt, retiredAt: c.retiredAt };
}

export function projectAuditEntry(a: AuditRow): StaffAuditEntry {
  return { id: a.id, action: a.action, targetType: a.targetType, targetId: a.targetId, actorName: a.actorName, createdAt: a.createdAt };
}
