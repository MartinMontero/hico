import * as v from 'valibot';
import { LIMITS } from './limits.ts';
import { activityFields, offerFields, placeFields, zoneFields } from './staff-content-schemas.ts';

// Bulk onboarding is deliberately narrower than the staff editor: new rows at one property only.
// Unknown fields (including verification stamps) are stripped by Valibot. `clientKey` detects repeats
// inside a file; it is not persisted and is not presented as a durable idempotency key.

const clientKey = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80), v.regex(/^[A-Za-z0-9._-]+$/));
const items = <T extends v.GenericSchema>(item: T) => v.pipe(v.array(item), v.minLength(1), v.maxLength(100));
const { zoneId: _zoneId, ...activityWithoutZone } = activityFields;
void _zoneId; // Import resolves a zone by its own-property English label instead of accepting an id.

export const activityImportItemSchema = v.object({
  ...activityWithoutZone,
  clientKey,
  zoneLabelEn: v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.label)),
  offeredAt: v.pipe(v.array(v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.slug), v.regex(/^[a-z0-9-]+$/))), v.maxLength(1)),
});
export const placeImportItemSchema = v.object({ ...placeFields, clientKey });
export const offerImportItemSchema = v.object({ ...offerFields, clientKey });
export const zoneImportItemSchema = v.object({ ...zoneFields, clientKey });

export const importDocumentSchema = v.variant('format', [
  v.object({ format: v.literal('hico-activities-v1'), items: items(activityImportItemSchema) }),
  v.object({ format: v.literal('hico-places-v1'), items: items(placeImportItemSchema) }),
  v.object({ format: v.literal('hico-offers-v1'), items: items(offerImportItemSchema) }),
  v.object({ format: v.literal('hico-zones-v1'), items: items(zoneImportItemSchema) }),
]);

export const importBodySchema = v.object({
  mode: v.picklist(['dry_run', 'apply']),
  document: importDocumentSchema,
  confirmation: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))),
});

export type ImportDocument = v.InferOutput<typeof importDocumentSchema>;
export type ImportBody = v.InferOutput<typeof importBodySchema>;
export type ImportItem = ImportDocument['items'][number];
export type ImportFormat = ImportDocument['format'];

export interface ImportIssue {
  index: number;
  code: 'duplicate_client_key' | 'duplicate_content' | 'unknown_zone' | 'off_property_share' | 'end_before_start' | 'ends_before_start';
  clientKey?: string;
}

export interface ImportReport {
  mode: 'dry_run' | 'apply';
  format: ImportFormat;
  valid: boolean;
  itemCount: number;
  issues: ImportIssue[];
  confirmation?: string;
  imported?: number;
}
