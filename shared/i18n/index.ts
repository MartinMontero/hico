import { en, type MessageKey } from './en.ts';
import { fr } from './fr.ts';
import type { Language } from '../schemas.ts';
import type { Bilingual } from '../types.ts';

export type { MessageKey };

const catalogs: Record<Language, Partial<Record<MessageKey, string>>> = { en, fr };

function fill(template: string, params?: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? '');
}

/**
 * 05 §13: the guest's language if the string exists, else English with a visible marker.
 * Never a blank and never a raw key.
 */
export function translate(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string>,
  source: Record<Language, Partial<Record<MessageKey, string>>> = catalogs,
): string {
  const own = source[lang][key];
  if (own !== undefined && own !== '') return fill(own, params);
  const fallback = en[key];
  const text = fill(fallback, params);
  return lang === 'en' ? text : `${text} (${en['meta.englishOnly']})`;
}

/** The same rule for bilingual content fields that come from the API. */
export function pick(value: Bilingual, lang: Language): string {
  const own = value[lang];
  if (own !== '') return own;
  const other = value.en !== '' ? value.en : value.fr;
  return lang === 'en' || other === '' ? other : `${other} (${en['meta.englishOnly']})`;
}

export const ALL_KEYS = Object.keys(en) as MessageKey[];
export { en, fr };
