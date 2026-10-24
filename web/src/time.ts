import type { PublicActivity } from '../../shared/types.ts';

// Dates are stored in UTC and shown in the PROPERTY's timezone, never the device's (CLAUDE.md).

/** 'YYYY-MM-DD' of an instant in a time zone. */
export function ymdInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Day of week (0 = Sunday) of a calendar date. The date has no zone, so noon UTC is safe. */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven days starting today in the property's zone. */
export function weekFrom(now: Date, timeZone: string): string[] {
  const today = ymdInZone(now, timeZone);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

export function formatDay(ymd: string, lang: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...opts }).format(new Date(`${ymd}T12:00:00Z`));
}

/** 'HH:MM' wall-clock text for a language. */
export function formatLocalTime(hhmm: string, lang: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return new Intl.DateTimeFormat(lang, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(
    new Date(Date.UTC(2000, 0, 1, h, m)),
  );
}

function timeOfInstant(epochSeconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(
    new Date(epochSeconds * 1000),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

export interface Occurrence {
  activity: PublicActivity;
  /** wall-clock start 'HH:MM' in the activity's zone */
  start: string;
  cancelled: boolean;
}

/** Activities happening on a calendar date (in the property's zone), earliest first. */
export function occurrencesOn(ymd: string, activities: PublicActivity[], propertyTimeZone: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const a of activities) {
    if (a.weekday !== null && a.startLocal !== null) {
      if (a.weekday === weekdayOf(ymd)) {
        out.push({ activity: a, start: a.startLocal, cancelled: a.status === 'cancelled' || a.cancelledDates.includes(ymd) });
      }
    } else if (a.startsAt !== null) {
      if (ymdInZone(new Date(a.startsAt * 1000), propertyTimeZone) === ymd) {
        out.push({ activity: a, start: timeOfInstant(a.startsAt, propertyTimeZone), cancelled: a.status === 'cancelled' });
      }
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start) || x.activity.title.en.localeCompare(y.activity.title.en));
}
