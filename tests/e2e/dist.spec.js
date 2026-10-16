// tests/e2e/dist.spec.js — le fichier autonome fonctionne en file:// sans aucune requête.
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('dist/freudiff.html en file://', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/freudiff.html'));
  await page.locator('#fallback').setInputFiles('tests/fixtures/projects');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLID');
  await page.reload(); // l'accueil (et le bouton démo) est masqué une fois le bilan affiché
  await page.click('#demo');
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  expect(urls).toEqual([]);
});
