// scripts/shots.mjs — rend la carte de démo en PNG (assets/) pour le README. Usage : node scripts/shots.mjs
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { renderCard } from '../src/card.js';
import { computeProfile } from '../src/profile.js';
import DEMO_STATS from '../src/demo.js';

await mkdir('assets', { recursive: true });
const browser = await chromium.launch();
for (const [theme, lang] of [['light', 'en'], ['dark', 'en']]) {
  const svg = renderCard(DEMO_STATS, computeProfile(DEMO_STATS), { lang, theme });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await writeFile(`assets/card-${theme}.png`, await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
console.log('assets/card-light.png, assets/card-dark.png');
