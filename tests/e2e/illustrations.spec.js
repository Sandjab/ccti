// tests/e2e/illustrations.spec.js — illustrations des 16 types (assets/types/<lang>/<CODE>.webp).
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('le bilan montre l\'illustration du type, dans la langue de la page', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  const img = page.locator('#diagnosis img.type-illustration');
  await expect(img).toHaveAttribute('src', 'assets/types/fr/AVPN.webp');
  await expect(img).toHaveAttribute('alt', /L'Architecte noctambule/);
  await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
  await page.click('#lang');
  await expect(img).toHaveAttribute('src', 'assets/types/en/AVPN.webp');
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
  await page.goto('file://' + path.resolve('dist/freudiff.html'));
  await page.click('#demo');
  await expect(page.locator('#diagnosis img.type-illustration')).toBeHidden();
});
