import * as v from 'valibot';
import { LIMITS } from './limits.ts';
import { idSchema } from './staff-schemas.ts';

// Request bodies for the content the staff edit. Every length is the limit the database CHECKs.
// These are plain objects, not strict ones: unknown fields (a client sending verified_on or verified_by,
// say) are dropped on parse, so the server's own stamp is the only one that can ever be stored.

// oxlint-disable-next-line eslint/no-control-regex -- rejecting control characters is the point of this pattern
const noControl = v.regex(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/, 'control characters are not allowed');
const text = (max: number) => v.pipe(v.string(), v.trim(), v.maxLength(max), noControl);
const required = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max), noControl);
const version = v.pipe(v.number(), v.integer(), v.minValue(1));
const hhmm = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/));
const date = v.pipe(v.string(), v.length(LIMITS.date), v.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/));

export const ACTIVITY_CATEGORIES = ['adventure', 'social', 'wellness', 'culture', 'outdoor'] as const;
export const PLACE_CATEGORIES = ['trails', 'food', 'drinks', 'culture', 'adventure'] as const;
export const RINGS = ['in_hostel', 'short_walk', 'further'] as const;
export const FEATURES = ['common_room', 'connect'] as const;

export const scheduleSchema = v.variant('kind', [
  v.object({ kind: v.literal('weekly'), weekday: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6)), startLocal: hhmm, endLocal: v.nullable(hhmm) }),
  v.object({ kind: v.literal('one_off'), date, startLocal: hhmm, endLocal: v.nullable(hhmm) }),
]);

export const activityFields = {
  titleEn: required(LIMITS.title),
  titleFr: text(LIMITS.title),
  descriptionEn: text(LIMITS.description),
  descriptionFr: text(LIMITS.description),
  /** A short note on an activity that has changed (O-24, D-39). Empty means nothing has changed. */
  changeNoteEn: text(LIMITS.changeNote),
  changeNoteFr: text(LIMITS.changeNote),
  category: v.picklist(ACTIVITY_CATEGORIES),
  zoneId: v.nullable(idSchema),
  hostLabel: text(LIMITS.label),
  capacity: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000))),
  schedule: scheduleSchema,
};
export const activityCreateSchema = v.object(activityFields);
export const activityUpdateSchema = v.object({ ...activityFields, version });
export const versionSchema = v.object({ version });
export const statusSchema = v.object({ version, status: v.picklist(['active', 'cancelled']) });
export const dateBodySchema = v.object({ date });
export const slugBodySchema = v.object({ slug: v.pipe(v.string(), v.minLength(1), v.maxLength(LIMITS.slug), v.regex(/^[a-z0-9-]+$/)) });

export const placeFields = {
  category: v.picklist(PLACE_CATEGORIES),
  name: required(LIMITS.name),
  staffPick: v.boolean(),
  noteEn: text(LIMITS.note),
  noteFr: text(LIMITS.note),
  walkTimeEn: text(LIMITS.shortText),
  walkTimeFr: text(LIMITS.shortText),
  hoursEn: text(LIMITS.hoursText),
  hoursFr: text(LIMITS.hoursText),
  phone: v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.phone), noControl)),
  mapsAddress: text(LIMITS.address),
};
export const placeCreateSchema = v.object(placeFields);
export const placeUpdateSchema = v.object({ ...placeFields, version });

export const offerFields = {
  partnerName: required(LIMITS.name),
  termsEn: required(LIMITS.terms),
  termsFr: text(LIMITS.terms),
  validFrom: v.nullable(date),
  validTo: v.nullable(date),
  requiresMembership: v.boolean(),
  howWeKnowEn: text(LIMITS.note),
  howWeKnowFr: text(LIMITS.note),
};
export const offerCreateSchema = v.object(offerFields);
export const offerUpdateSchema = v.object({ ...offerFields, version });

export const zoneFields = { labelEn: required(LIMITS.label), labelFr: text(LIMITS.label), ring: v.picklist(RINGS) };
export const zoneCreateSchema = v.object(zoneFields);
export const zoneUpdateSchema = v.object({ ...zoneFields, version });

export const codeCreateSchema = v.object({ label: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.minLength(1), v.maxLength(40), v.regex(/^[a-z0-9-]+$/)) });
export const featureBodySchema = v.object({ enabled: v.boolean() });
export const featureNameSchema = v.picklist(FEATURES);

export type ActivityInput = v.InferOutput<typeof activityCreateSchema>;
export type PlaceInput = v.InferOutput<typeof placeCreateSchema>;
export type OfferInput = v.InferOutput<typeof offerCreateSchema>;
export type ZoneInput = v.InferOutput<typeof zoneCreateSchema>;
