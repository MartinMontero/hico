// "Mountain Lodge" tokens (02 §1) plus AA-safe additions. web/src/styles/tokens.css is generated
// from this file by scripts/contrast.ts --write-css and checked by tests/node/contrast.test.ts, so
// the colours the page uses are exactly the colours the contrast gate measured.

export const COLORS = {
  deep: '#121a21',
  timber: '#1a2530',
  ridge: '#243040',
  stone: '#7a8e9e',
  cream: '#e8e0d6',
  white: '#f5f0ea',
  trail: '#2ea872',
  trailDk: '#1e8a5a',
  ember: '#e07a4f',
  emberLt: '#f0a878',
  sky: '#5ba0d4',
  gold: '#d4a83a',
  coral: '#cc3d3d',
  // Additions: `stone` on `ridge` is 3.94:1 and fails, and `coral` text on dark fails (02 row 13).
  stoneLt: '#a9b8c4',
  coralLt: '#f08a8a',
} as const;

export type ColorName = keyof typeof COLORS;

export interface Pair {
  text: ColorName;
  background: ColorName;
  /** normal text needs 4.5:1; large text and non-text UI 3:1 */
  kind: 'normal' | 'large' | 'ui';
  use: string;
}

// Every text/background pairing the stylesheet uses. Adding a pairing here is how it gets measured.
export const PAIRS: Pair[] = [
  { text: 'cream', background: 'deep', kind: 'normal', use: 'body text on page' },
  { text: 'cream', background: 'timber', kind: 'normal', use: 'body text on cards' },
  { text: 'cream', background: 'ridge', kind: 'normal', use: 'body text on raised surfaces' },
  { text: 'white', background: 'deep', kind: 'normal', use: 'headings on page' },
  { text: 'white', background: 'ridge', kind: 'normal', use: 'headings on raised surfaces' },
  { text: 'stoneLt', background: 'deep', kind: 'normal', use: 'secondary text on page' },
  { text: 'stoneLt', background: 'timber', kind: 'normal', use: 'secondary text on cards' },
  { text: 'stoneLt', background: 'ridge', kind: 'normal', use: 'secondary text on raised surfaces' },
  { text: 'deep', background: 'trail', kind: 'normal', use: 'primary button label' },
  { text: 'deep', background: 'ember', kind: 'normal', use: 'accent button label' },
  { text: 'deep', background: 'gold', kind: 'normal', use: 'staff-pick badge' },
  { text: 'trail', background: 'deep', kind: 'normal', use: 'accent text on page' },
  { text: 'trail', background: 'timber', kind: 'normal', use: 'accent text on cards' },
  { text: 'emberLt', background: 'timber', kind: 'normal', use: 'highlight text on cards' },
  { text: 'sky', background: 'deep', kind: 'normal', use: 'links on page' },
  { text: 'sky', background: 'timber', kind: 'normal', use: 'links on cards' },
  { text: 'coralLt', background: 'deep', kind: 'normal', use: 'error text on page' },
  { text: 'coralLt', background: 'timber', kind: 'normal', use: 'error text on cards' },
  { text: 'sky', background: 'deep', kind: 'ui', use: 'focus ring against page' },
  { text: 'sky', background: 'ridge', kind: 'ui', use: 'focus ring against raised surfaces' },
  { text: 'stone', background: 'deep', kind: 'ui', use: 'borders and dividers' },
];

export const MIN_RATIO: Record<Pair['kind'], number> = { normal: 4.5, large: 3, ui: 3 };

export function tokensCss(): string {
  const lines = Object.entries(COLORS).map(([k, v]) => `  --c-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`);
  return `/* Generated from shared/tokens.ts by scripts/contrast.ts --write-css. Do not edit. */\n:root {\n${lines.join('\n')}\n}\n`;
}
