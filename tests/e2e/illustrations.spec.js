// tests/e2e/illustrations.spec.js — illustrations des 16 types (assets/types/<lang>/<CODE>.webp).
import { test, expect } from '@playwright/test';
import path from 'node:path';

// L'image est embarquée en data URI : sans cela, le PNG de la carte la perdrait.
test('la carte montre l\'illustration du type, dans la langue de la page', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  const href = () => page.locator('#card svg image').getAttribute('href');
  await expect.poll(href).toMatch(/^data:image\/webp;base64,/);
  const fr = await href();
  await page.click('#lang');
  await expect(page.locator('#card svg')).toContainText('The Night Architect');
  await expect.poll(href).toMatch(/^data:image\/webp;base64,/);
  expect(await href()).not.toBe(fr);
  await expect(page.locator('#diagnosis img')).toHaveCount(0);
});

test('l\'accueil présente les 16 types en galerie', async ({ page }) => {
  await page.goto('/');
  const imgs = page.locator('#types-gallery img');
  await expect(imgs).toHaveCount(16);
  for (const alt of await imgs.evaluateAll((els) => els.map((e) => e.alt))) expect(alt.length).toBeGreaterThan(3);
  await imgs.first().scrollIntoViewIfNeeded();
  await expect.poll(() => imgs.first().evaluate((e) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
});

// Le fichier autonome n'embarque pas les images : pas d'icône d'image cassée, pas de requête.
test('fichier hors ligne : illustration absente masquée proprement', async ({ page }) => {
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.click('#demo');
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  await expect(page.locator('#card svg image')).toHaveCount(0);
});
