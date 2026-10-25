import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Renders public/icon.svg to the two PNG sizes the web app manifest and iOS want. Run by hand when the icon changes:
//   node scripts/make-icons.ts
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: `public/icon-${size}.png`, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('wrote public/icon-192.png and public/icon-512.png');