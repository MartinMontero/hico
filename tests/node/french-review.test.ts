import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, fr } from '../../shared/i18n/index.ts';
import { frNeedsReview, FR_REVIEWED, STAFF_FR_REVIEWED, staffFrNeedsReview } from '../../shared/i18n/review.ts';
import { staffEn } from '../../shared/i18n/staff-en.ts';
import { staffFr } from '../../shared/i18n/staff-fr.ts';

// D-19: French is complete, drafted by Claude Code, and none of it is marked reviewed.

describe('French', () => {
  it('has a non-empty string for every English key, guest and staff', () => {
    for (const k of Object.keys(en)) expect((fr as Record<string, string>)[k], k).toBeTruthy();
    for (const k of Object.keys(staffEn)) expect((staffFr as Record<string, string>)[k], k).toBeTruthy();
  });

  it('has the same {placeholders} as the English, so no value is dropped or invented', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [k, v] of Object.entries(en)) expect(names((fr as Record<string, string>)[k] ?? ''), k).toEqual(names(v));
    for (const [k, v] of Object.entries(staffEn)) expect(names((staffFr as Record<string, string>)[k] ?? ''), k).toEqual(names(v));
  });

  it('is not marked reviewed: nobody has been named to review it, so every string is on the needs-review list', () => {
    expect(FR_REVIEWED.size).toBe(0);
    expect(STAFF_FR_REVIEWED.size).toBe(0);
    expect(frNeedsReview()).toHaveLength(Object.keys(en).length);
    expect(staffFrNeedsReview()).toHaveLength(Object.keys(staffEn).length);
  });

  it('a reviewed key must exist (no stale names)', () => {
    for (const k of FR_REVIEWED) expect(Object.keys(en)).toContain(k);
    for (const k of STAFF_FR_REVIEWED) expect(Object.keys(staffEn)).toContain(k);
  });
});

describe('no English in the guest screens outside the catalog', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'staff' ? [] : files(join(dir, e.name))) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));

  it('JSX text, labels and placeholders in web/src (not the staff console) all come from the catalog', () => {
    const offenders: string[] = [];
    for (const f of files('web/src')) {
      const text = readFileSync(f, 'utf8');
      // text between tags that has letters and is not an expression: <p>Hello</p>
      for (const m of text.matchAll(/(?<!=)>\s*([A-Za-z][^<>{}\n]*[A-Za-z.!?])\s*</g)) offenders.push(`${f}: ${m[1]}`);
      for (const m of text.matchAll(/\b(?:aria-label|placeholder|title|alt)="([A-Za-z][^"]*)"/g)) offenders.push(`${f}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});