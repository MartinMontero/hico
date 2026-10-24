import { describe, expect, it } from 'vitest';
import { ALL_KEYS, en, fr, pick, translate } from '../../shared/i18n/index.ts';
import type { MessageKey } from '../../shared/i18n/index.ts';

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
    expect(text).toBe('Explore (English only)');
    expect(text).not.toBe('');
    expect(text).not.toBe('nav.explore');
  });

  it('an empty French string counts as missing', () => {
    const text = translate('fr', 'nav.explore', undefined, { en: partial.en, fr: { 'nav.explore': '' } });
    expect(text).toContain('English only');
  });

  it('fills placeholders and drops unknown ones to empty', () => {
    expect(translate('en', 'toast.language', { language: 'English' })).toBe('Language set to English');
    expect(translate('en', 'toast.language')).toBe('Language set to ');
  });

  it('bilingual content fields follow the same rule', () => {
    expect(pick({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour');
    expect(pick({ en: 'Hello', fr: '' }, 'fr')).toBe('Hello (English only)');
    expect(pick({ en: 'Hello', fr: '' }, 'en')).toBe('Hello');
    expect(pick({ en: '', fr: '' }, 'fr')).toBe('');
  });
});
