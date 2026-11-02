import { CHECK_LIMIT_DAYS, pastCheckLimit, type CheckKind } from './check-limits.ts';

export type ContentKind = 'activities' | 'places' | 'offers' | 'zones';
export type ContentHealthReason = 'unverified' | 'stale' | 'placeholder';

export interface ContentHealthSource {
  id: string;
  title: string;
  verifiedOn: number | null;
  isPlaceholder: number;
}

export interface ContentHealthSummary {
  kind: ContentKind;
  total: number;
  missing: boolean;
  unverified: number;
  stale: number;
  placeholder: number;
}

export interface ContentHealthItem {
  kind: Exclude<ContentKind, 'zones'>;
  id: string;
  title: string;
  verifiedOn: number | null;
  reasons: ContentHealthReason[];
}

export interface ContentHealthReport {
  generatedAt: number;
  checkLimitDays: typeof CHECK_LIMIT_DAYS;
  summaries: ContentHealthSummary[];
  items: ContentHealthItem[];
}

type StampedKind = Exclude<ContentKind, 'zones'>;
const KIND_FOR: Record<StampedKind, CheckKind> = { activities: 'board', places: 'places', offers: 'offers' };

/**
 * Turns tenant-scoped repository rows into an actionable report. The caller supplies only one property's rows;
 * this function never queries or accepts a property selector, so it cannot widen that scope.
 */
export function buildContentHealth(
  input: Record<StampedKind, readonly ContentHealthSource[]> & { zones: number },
  now: number,
): ContentHealthReport {
  const summaries: ContentHealthSummary[] = [];
  const items: ContentHealthItem[] = [];
  for (const kind of ['activities', 'places', 'offers'] as const) {
    const rows = input[kind];
    let unverified = 0;
    let stale = 0;
    let placeholder = 0;
    for (const row of rows) {
      const reasons: ContentHealthReason[] = [];
      if (row.verifiedOn === null) {
        unverified += 1;
        reasons.push('unverified');
      } else if (pastCheckLimit(row.verifiedOn, now, KIND_FOR[kind])) {
        stale += 1;
        reasons.push('stale');
      }
      if (row.isPlaceholder === 1) {
        placeholder += 1;
        reasons.push('placeholder');
      }
      if (reasons.length > 0) items.push({ kind, id: row.id, title: row.title, verifiedOn: row.verifiedOn, reasons });
    }
    summaries.push({ kind, total: rows.length, missing: rows.length === 0, unverified, stale, placeholder });
  }
  summaries.push({ kind: 'zones', total: input.zones, missing: input.zones === 0, unverified: 0, stale: 0, placeholder: 0 });
  items.sort((a, b) => (a.verifiedOn ?? 0) - (b.verifiedOn ?? 0) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  return { generatedAt: now, checkLimitDays: CHECK_LIMIT_DAYS, summaries, items };
}
