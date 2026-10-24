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
  verifiedBy: string | null;
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
  verifiedBy: string | null;
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
  verifiedBy: string | null;
  isPlaceholder: boolean;
}

/** Field allow-lists, used by projections and by tests/worker/anonymous-surface.test.ts. */
export const PUBLIC_FIELDS = {
  property: ['slug', 'name', 'timezone', 'languages', 'features', 'hasPlaceholders'],
  propertyChoice: ['slug', 'name'],
  activity: [
    'id', 'title', 'description', 'category', 'zone', 'hostLabel', 'timezone', 'weekday',
    'startLocal', 'endLocal', 'startsAt', 'endsAt', 'capacity', 'status', 'cancelledDates',
    'verifiedOn', 'verifiedBy', 'isPlaceholder',
  ],
  place: [
    'id', 'category', 'name', 'staffPick', 'note', 'walkTime', 'hours', 'phone', 'mapsAddress',
    'verifiedOn', 'verifiedBy', 'isPlaceholder',
  ],
  offer: [
    'id', 'partnerName', 'terms', 'validFrom', 'validTo', 'requiresMembership', 'howWeKnow',
    'verifiedOn', 'verifiedBy', 'isPlaceholder',
  ],
  bilingual: ['en', 'fr'],
  features: ['common_room', 'connect'],
} as const;
