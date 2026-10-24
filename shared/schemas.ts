import * as v from 'valibot';
import { LIMITS } from './limits.ts';

// One validation library for browser and Worker (D-13). Lengths come from limits.ts.

export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

export const slugSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(LIMITS.slug),
  v.regex(/^[a-z0-9-]+$/),
);

export const dateSchema = v.pipe(v.string(), v.length(LIMITS.date), v.regex(/^\d{4}-\d{2}-\d{2}$/));

export const daySchema = v.object({ day: v.optional(dateSchema) });

/** Aggregate events a page may report. Anything else is rejected, so junk cannot fill the table. */
export const EVENT_NAMES = [
  'opened_whats_on',
  'opened_explore',
  'opened_common_room',
  'opened_connect',
  'offer_shown',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const eventBodySchema = v.strictObject({
  event: v.picklist(EVENT_NAMES),
});

export function parseLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim().toLowerCase().slice(0, 2);
  return first === 'fr' ? 'fr' : first === 'en' ? 'en' : null;
}
