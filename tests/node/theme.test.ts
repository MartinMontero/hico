import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../../shared/contrast.ts';
import { COLORS, MIN_RATIO, PAIRS, tokensCss } from '../../shared/tokens.ts';

describe('contrast gate', () => {
  it('every text/background pair meets its minimum (4.5:1 normal, 3:1 large and UI)', () => {
    const failing = PAIRS.map((p) => ({ p, ratio: contrast(COLORS[p.text], COLORS[p.background]) }))
      .filter(({ p, ratio }) => ratio < MIN_RATIO[p.kind])
      .map(({ p, ratio }) => `${p.text} on ${p.background}: ${ratio.toFixed(2)}`);
    expect(failing).toEqual([]);
  });

  it('matches the figures measured in 02 row 13', () => {
    expect(contrast(COLORS.deep, COLORS.trail)).toBeCloseTo(5.82, 2);
    expect(contrast(COLORS.deep, COLORS.ember)).toBeCloseTo(5.91, 2);
    expect(contrast(COLORS.cream, COLORS.deep)).toBeCloseTo(13.44, 2);
    expect(contrast(COLORS.stone, COLORS.deep)).toBeCloseTo(5.18, 2);
    // The failures the prototype had, and why they are not used as text:
    expect(contrast(COLORS.white, COLORS.trail)).toBeCloseTo(2.66, 2);
    expect(contrast(COLORS.stone, COLORS.ridge)).toBeLessThan(4.5);
    expect(contrast(COLORS.coral, COLORS.deep)).toBeLessThan(4.5);
  });

  it('no pairing uses coral as text on a dark surface, or stone as normal text on ridge', () => {
    expect(PAIRS.some((p) => p.text === 'coral' && p.kind === 'normal')).toBe(false);
    expect(PAIRS.some((p) => p.text === 'stone' && p.background === 'ridge' && p.kind === 'normal')).toBe(false);
    expect(PAIRS.some((p) => p.text === 'white' && p.background === 'trail')).toBe(false);
  });

  it('the stylesheet colours are exactly the measured ones (tokens.css is generated from tokens.ts)', () => {
    expect(readFileSync('web/src/styles/tokens.css', 'utf8')).toBe(tokensCss());
  });

  it('base.css uses only variables from tokens.css and no literal colours', () => {
    const css = readFileSync('web/src/styles/base.css', 'utf8');
    expect(css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    const defined = new Set([...readFileSync('web/src/styles/tokens.css', 'utf8').matchAll(/(--c-[\w-]+):/g)].map((m) => m[1]));
    const used = [...css.matchAll(/var\((--c-[\w-]+)/g)].map((m) => m[1] as string);
    expect(used.filter((u) => !defined.has(u))).toEqual([]);
  });

  it('the original design tokens are unchanged (02 §1)', () => {
    expect(COLORS).toMatchObject({
      deep: '#121a21', timber: '#1a2530', ridge: '#243040', stone: '#7a8e9e', cream: '#e8e0d6', white: '#f5f0ea',
      trail: '#2ea872', trailDk: '#1e8a5a', ember: '#e07a4f', emberLt: '#f0a878', sky: '#5ba0d4', gold: '#d4a83a', coral: '#cc3d3d',
    });
  });

  it('text is never below 12 px in the stylesheet', () => {
    const css = readFileSync('web/src/styles/base.css', 'utf8');
    for (const m of css.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)) {
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
      expect(px).toBeGreaterThanOrEqual(12);
    }
  });
});
