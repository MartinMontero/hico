import { describe, expect, it } from 'vitest';
import { ALL_KEYS, en, fr, pick, translate } from '../../shared/i18n/index.ts';
import type { MessageKey } from '../../shared/i18n/index.ts';
import { makeTranslator } from '../../shared/i18n/index.ts';
import { staffEn } from '../../shared/i18n/staff-en.ts';
import { staffFr } from '../../shared/i18n/staff-fr.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('catalogs', () => {
  it('every English key has a non-empty French string (the build fails otherwise)', () => {
    const missing = ALL_KEYS.filter((k) => !fr[k] || fr[k].trim() === '');
    expect(missing).toEqual([]);
  });

  it('French has no keys English lacks', () => {
    expect(Object.keys(fr).filter((k) => !(k in en))).toEqual([]);
  });

  it('placeholders match between languages', () => {
    for (const k of ALL_KEYS) expect(placeholders(fr[k]), k).toEqual(placeholders(en[k]));
  });

  it('no text names the product "HI" anywhere (D-21)', () => {
    for (const k of ALL_KEYS) {
      expect(en[k], k).not.toMatch(/\bHI\b/);
      expect(fr[k], k).not.toMatch(/\bHI\b/);
    }
  });
});

describe('lookup rule (05 §13)', () => {
  const partial = { en: { 'nav.explore': 'Explore' }, fr: {} } as Record<'en' | 'fr', Partial<Record<MessageKey, string>>>;

  it("uses the guest's language when the string exists", () => {
    expect(translate('fr', 'nav.explore')).toBe('Explorer');
    expect(translate('en', 'nav.explore')).toBe('Explore');
  });

  it('falls back to English with a visible marker, never blank, never a raw key', () => {
    const text = translate('fr', 'nav.explore', undefined, { en: partial.en, fr: {} });
    expect(text).toBe('Explore (anglais seulement)'); // the marker is in the language of the person reading
    expect(text).not.toBe('');
    expect(text).not.toBe('nav.explore');
  });

  it('an empty French string counts as missing', () => {
    const text = translate('fr', 'nav.explore', undefined, { en: partial.en, fr: { 'nav.explore': '' } });
    expect(text).toContain('anglais seulement');
  });

  it('fills placeholders and drops unknown ones to empty', () => {
    expect(translate('en', 'toast.language', { language: 'English' })).toBe('Language set to English');
    expect(translate('en', 'toast.language')).toBe('Language set to ');
  });

  it('bilingual content fields follow the same rule', () => {
    expect(pick({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour');
    expect(pick({ en: 'Hello', fr: '' }, 'fr')).toBe('Hello (anglais seulement)');
    expect(pick({ en: 'Hello', fr: '' }, 'en')).toBe('Hello');
    expect(pick({ en: '', fr: '' }, 'fr')).toBe('');
  });
});

describe('staff console catalogs (kept apart so guests never download them)', () => {
  const keys = Object.keys(staffEn) as (keyof typeof staffEn)[];
  it('every English key has a non-empty French string', () => {
    expect(keys.filter((k) => !staffFr[k] || staffFr[k].trim() === '')).toEqual([]);
    expect(Object.keys(staffFr).filter((k) => !(k in staffEn))).toEqual([]);
  });
  it('placeholders match between languages', () => {
    for (const k of keys) expect(placeholders(staffFr[k]), k).toEqual(placeholders(staffEn[k]));
  });
  it('no text names the product "HI" (D-21)', () => {
    for (const k of keys) {
      expect(staffEn[k], k).not.toMatch(/\bHI\b/);
      expect(staffFr[k], k).not.toMatch(/\bHI\b/);
    }
  });
  it('follows the same lookup rule: French, else English with the visible marker', () => {
    const tr = makeTranslator<'a'>({ a: 'Hello {name}' }, { a: '' });
    expect(tr('fr', 'a', { name: 'Eli' })).toBe('Hello Eli (anglais seulement)');
    expect(tr('en', 'a', { name: 'Eli' })).toBe('Hello Eli');
    const tr2 = makeTranslator<'a'>({ a: 'Hello' }, { a: 'Bonjour' });
    expect(tr2('fr', 'a')).toBe('Bonjour');
  });
});