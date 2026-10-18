// tests/e2e/ccti.spec.js — parcours complet sur les fixtures, sans aucune requête externe.
import { test, expect } from '@playwright/test';
import { statSync } from 'node:fs';

const external = (page) => {
  const urls = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== '127.0.0.1:8765' && u.protocol !== 'blob:' && u.protocol !== 'data:') urls.push(r.url()); });
  return urls;
};

test('analyse des fixtures, carte, exports, langue, thème', async ({ page }) => {
  const urls = external(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Votre binôme Claude Code en 4 lettres : un test de personnalité à 16 types.');
  await page.locator('#fallback').setInputFiles('tests/fixtures/projects');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText("Le Tireur d'élite");
  await expect(page.locator('#card svg')).toContainText('CLID');
  await expect(page.locator('#diagnosis li')).toHaveCount(5);
  await expect(page.locator('#sections .section')).toHaveCount(7); // 6 + Gaspillage
  await expect(page.locator('#lowconf')).toBeHidden();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#png')]);
  expect(download.suggestedFilename()).toBe('ccti-CLID.png');
  expect(statSync(await download.path()).size).toBeGreaterThan(10_000);
  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#json')]);
  expect(json.suggestedFilename()).toBe('ccti-stats.json');
  await page.click('#lang');
  await expect(page.locator('#card svg')).toContainText('The Sniper');
  await expect(page.locator('h2', { hasText: 'The couple' })).toBeVisible();
  await page.click('#theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#card svg rect').first()).toHaveAttribute('fill', '#0F1A15');
  expect(urls).toEqual([]);
});

test('le parent de projects/ fonctionne aussi', async ({ page }) => {
  await page.goto('/');
  await page.locator('#fallback').setInputFiles('tests/fixtures');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLID');
});

test('démo et dossier vide', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#demo-banner')).toBeVisible();
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  await page.click('#again');
  await expect(page.locator('#intro')).toBeVisible();
  await page.locator('#fallback').setInputFiles('tests/e2e');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#intro')).toBeVisible();
});
