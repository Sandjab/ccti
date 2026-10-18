// tests/e2e/dist.spec.js — le fichier autonome fonctionne en file:// sans aucune requête.
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('dist/ccti.html en file://', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.locator('#fallback').setInputFiles('tests/fixtures/projects');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLID');
  await page.reload(); // l'accueil (et le bouton démo) est masqué une fois le bilan affiché
  await page.click('#demo');
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  expect(urls).toEqual([]);
});

test('dist/ccti.html : sessions Codex et démo à deux bilans, en file://', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await page.reload();
  await page.click('#demo');
  await page.locator('#tools button').nth(1).click();
  await expect(page.locator('#card svg')).toContainText('Le Joueur de YOLO');
  expect(urls).toEqual([]);
});
