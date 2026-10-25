import type {
  PublicActivity,
  PublicOffer,
  PublicPlace,
  PublicProperty,
  PublicPropertyChoice,
  FeatureName,
} from '../shared/types.ts';
import type { ActivityWithDates } from './repositories/activities.ts';
import type { PlaceRow } from './repositories/places.ts';
import type { OfferRow } from './repositories/offers.ts';
import type { PropertyRow } from './repositories/properties.ts';
import type { HostProperty } from './repositories/hosts.ts';

// Named public projections. Each lists its fields explicitly; nothing is spread from a row.
// No property id, owner id, staff id or author session id appears in any of them.

export function projectPropertyChoice(p: HostProperty): PublicPropertyChoice {
  return { slug: p.slug, name: { en: p.name.en, fr: p.name.fr } };
}

export function projectProperty(p: PropertyRow, features: Record<FeatureName, boolean>): PublicProperty {
  return {
    slug: p.slug,
    name: { en: p.nameEn, fr: p.nameFr },
    timezone: p.timezone,
    languages: p.languages.split(','),
    features: { common_room: features.common_room, connect: features.connect },
    privacyContact: { title: p.privacyContactTitle, address: p.privacyContactAddress },
    hasPlaceholders: p.hasPlaceholders,
  };
}

export function projectActivity({ row, cancelledDates }: ActivityWithDates): PublicActivity {
  return {
    id: row.id,
    title: { en: row.title_en, fr: row.title_fr },
    description: { en: row.description_en, fr: row.description_fr },
    changeNote: { en: row.change_note_en, fr: row.change_note_fr },
    category: row.category,
    zone: row.zone_en !== null && row.zone_fr !== null ? { en: row.zone_en, fr: row.zone_fr } : null,
    hostLabel: row.host_label,
    timezone: row.timezone,
    weekday: row.weekday,
    startLocal: row.start_local,
    endLocal: row.end_local,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    status: row.status,
    cancelledDates,
    verifiedOn: row.verified_on,
    isPlaceholder: row.is_placeholder === 1,
  };
}

export function projectPlace(row: PlaceRow): PublicPlace {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    staffPick: row.staff_pick === 1,
    note: { en: row.note_en, fr: row.note_fr },
    walkTime: { en: row.walk_time_en, fr: row.walk_time_fr },
    hours: { en: row.hours_en, fr: row.hours_fr },
    phone: row.phone,
    mapsAddress: row.maps_address,
    verifiedOn: row.verified_on,
    isPlaceholder: row.is_placeholder === 1,
  };
}

export function projectOffer(row: OfferRow): PublicOffer {
  return {
    id: row.id,
    partnerName: row.partner_name,
    terms: { en: row.terms_en, fr: row.terms_fr },
    validFrom: row.valid_from,
    validTo: row.valid_to,
    requiresMembership: row.requires_membership === 1,
    howWeKnow: { en: row.how_we_know_en, fr: row.how_we_know_fr },
    verifiedOn: row.verified_on,
    isPlaceholder: row.is_placeholder === 1,
  };
}
