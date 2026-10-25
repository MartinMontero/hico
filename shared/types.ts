// What a client may see. Field lists here mirror worker/projections.ts exactly; the
// anonymous-surface test compares real responses to these allow-lists.

export interface Bilingual {
  en: string;
  fr: string;
}

export type ActivityCategory = 'adventure' | 'social' | 'wellness' | 'culture' | 'outdoor';
export type PlaceCategory = 'trails' | 'food' | 'drinks' | 'culture' | 'adventure';
export type FeatureName = 'common_room' | 'connect';

export interface PublicProperty {
  slug: string;
  name: Bilingual;
  timezone: string;
  languages: string[];
  features: Record<FeatureName, boolean>;
  hasPlaceholders: boolean;
}

export interface PublicPropertyChoice {
  slug: string;
  name: Bilingual;
}

export interface PublicActivity {
  id: string;
  title: Bilingual;
  description: Bilingual;
  category: ActivityCategory;
  zone: Bilingual | null;
  hostLabel: string;
  timezone: string;
  weekday: number | null;
  startLocal: string | null;
  endLocal: string | null;
  startsAt: number | null;
  endsAt: number | null;
  capacity: number | null;
  status: 'active' | 'cancelled';
  cancelledDates: string[];
  verifiedOn: number | null;
  isPlaceholder: boolean;
}

export interface PublicPlace {
  id: string;
  category: PlaceCategory;
  name: string;
  staffPick: boolean;
  note: Bilingual;
  walkTime: Bilingual;
  hours: Bilingual;
  phone: string | null;
  mapsAddress: string;
  verifiedOn: number | null;
  isPlaceholder: boolean;
}

export interface PublicOffer {
  id: string;
  partnerName: string;
  terms: Bilingual;
  validFrom: number | null;
  validTo: number | null;
  requiresMembership: boolean;
  howWeKnow: Bilingual;
  verifiedOn: number | null;
  isPlaceholder: boolean;
}

/** Field allow-lists, used by projections and by tests/worker/anonymous-surface.test.ts. */
export const PUBLIC_FIELDS = {
  property: ['slug', 'name', 'timezone', 'languages', 'features', 'hasPlaceholders'],
  propertyChoice: ['slug', 'name'],
  activity: [
    'id', 'title', 'description', 'category', 'zone', 'hostLabel', 'timezone', 'weekday',
    'startLocal', 'endLocal', 'startsAt', 'endsAt', 'capacity', 'status', 'cancelledDates',
    'verifiedOn', 'isPlaceholder',
  ],
  place: [
    'id', 'category', 'name', 'staffPick', 'note', 'walkTime', 'hours', 'phone', 'mapsAddress',
    'verifiedOn', 'isPlaceholder',
  ],
  offer: [
    'id', 'partnerName', 'terms', 'validFrom', 'validTo', 'requiresMembership', 'howWeKnow',
    'verifiedOn', 'isPlaceholder',
  ],
  bilingual: ['en', 'fr'],
  features: ['common_room', 'connect'],
} as const;

// ---- What staff see (never sent to a guest). Field lists mirror worker/projections.ts exactly. ----

export type Schedule =
  | { kind: 'weekly'; weekday: number; startLocal: string; endLocal: string | null }
  | { kind: 'one_off'; date: string; startLocal: string; endLocal: string | null };

/** `check` is the 09 §2 rule: a stamp past the limit in shared\check-limits.ts, or none, is overdue. */
export type CheckState = 'ok' | 'overdue';

export interface StaffActivity {
  id: string;
  title: Bilingual;
  description: Bilingual;
  category: ActivityCategory;
  zoneId: string | null;
  zone: Bilingual | null;
  hostLabel: string;
  capacity: number | null;
  status: 'active' | 'cancelled';
  schedule: Schedule;
  timezone: string;
  cancelledDates: string[];
  isOwner: boolean;
  offeredAt: { slug: string; name: Bilingual }[];
  canChangeList: boolean;
  verifiedOn: number | null;
  verifiedBy: string | null;
  check: CheckState;
  isPlaceholder: boolean;
  version: number;
}

export interface StaffPlace {
  id: string;
  category: PlaceCategory;
  name: string;
  staffPick: boolean;
  note: Bilingual;
  walkTime: Bilingual;
  hours: Bilingual;
  phone: string | null;
  mapsAddress: string;
  verifiedOn: number | null;
  verifiedBy: string | null;
  check: CheckState;
  isPlaceholder: boolean;
  version: number;
}

export interface StaffOffer {
  id: string;
  partnerName: string;
  terms: Bilingual;
  validFrom: string | null;
  validTo: string | null;
  requiresMembership: boolean;
  howWeKnow: Bilingual;
  verifiedOn: number | null;
  verifiedBy: string | null;
  /** What guests see: shown, or hidden because it is expired, not started, or unchecked past the limit. */
  guestState: 'shown' | 'expired' | 'not_started' | 'unchecked';
  isPlaceholder: boolean;
  version: number;
}

export interface StaffZone {
  id: string;
  label: Bilingual;
  ring: 'in_hostel' | 'short_walk' | 'further';
  inUse: boolean;
  version: number;
}

export interface StaffCode {
  id: string;
  label: string;
  createdAt: number;
  retiredAt: number | null;
}

export interface StaffAuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorName: string | null;
  createdAt: number;
}

export const STAFF_FIELDS = {
  activity: [
    'id', 'title', 'description', 'category', 'zoneId', 'zone', 'hostLabel', 'capacity', 'status', 'schedule', 'timezone',
    'cancelledDates', 'isOwner', 'offeredAt', 'canChangeList', 'verifiedOn', 'verifiedBy', 'check', 'isPlaceholder', 'version',
  ],
  place: ['id', 'category', 'name', 'staffPick', 'note', 'walkTime', 'hours', 'phone', 'mapsAddress', 'verifiedOn', 'verifiedBy', 'check', 'isPlaceholder', 'version'],
  offer: ['id', 'partnerName', 'terms', 'validFrom', 'validTo', 'requiresMembership', 'howWeKnow', 'verifiedOn', 'verifiedBy', 'guestState', 'isPlaceholder', 'version'],
  zone: ['id', 'label', 'ring', 'inUse', 'version'],
  code: ['id', 'label', 'createdAt', 'retiredAt'],
  audit: ['id', 'action', 'targetType', 'targetId', 'actorName', 'createdAt'],
  nested: ['en', 'fr', 'kind', 'weekday', 'startLocal', 'endLocal', 'date', 'slug', 'name'],
} as const;