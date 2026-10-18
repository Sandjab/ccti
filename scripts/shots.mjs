// scripts/shots.mjs — rend la carte de démo en PNG (assets/) pour le README. Usage : node scripts/shots.mjs
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { renderCard, CARD_W, CARD_H } from '../src/card.js';
import { computeProfile } from '../src/profile.js';
import DEMO_STATS from '../src/demo.js';

await mkdir('assets', { recursive: true });
const browser = await chromium.launch();
for (const [theme, lang] of [['light', 'en'], ['dark', 'en']]) {
  const profile = computeProfile(DEMO_STATS);
  const image = 'data:image/webp;base64,' + (await readFile(`assets/types/${lang}/${profile.code}.webp`)).toString('base64');
  const svg = renderCard(DEMO_STATS, profile, { lang, theme, image });
  const page = await browser.newPage({ viewport: { width: CARD_W, height: CARD_H }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await writeFile(`assets/card-${theme}.png`, await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
console.log('assets/card-light.png, assets/card-dark.png');
