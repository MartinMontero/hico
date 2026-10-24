import { useCallback } from 'preact/hooks';
import { makeTranslator } from '../../../shared/i18n/index.ts';
import { staffEn, type StaffKey } from '../../../shared/i18n/staff-en.ts';
import { staffFr } from '../../../shared/i18n/staff-fr.ts';
import { useUi } from '../context.tsx';

const translate = makeTranslator<StaffKey>(staffEn, staffFr);

export type StaffT = (key: StaffKey, params?: Record<string, string>) => string;

/** The staff console's translator: its own catalogs, the same fallback rule as the guest app. */
export function useStaffT(): StaffT {
  const { lang } = useUi();
  return useCallback((key: StaffKey, params?: Record<string, string>) => translate(lang, key, params), [lang]);
}

/** A date in the property's own time zone, never the device's (CLAUDE.md). */
export function formatDay(epochSeconds: number, lang: string, timeZone: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone }).format(new Date(epochSeconds * 1000));
}

export function formatMoment(epochSeconds: number, lang: string, timeZone: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(epochSeconds * 1000));
}
