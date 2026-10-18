// tests/e2e/cxti.spec.js — la page CXTI (spec CXTI § 6) : sessions Codex → bilan, carte CXTI,
// mesures absentes masquées, aucune requête hors du serveur local.
import { test, expect } from '@playwright/test';

test('sessions Codex → bilan CXTI', async ({ page }) => {
  const external = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://127.0.0.1:8765/') && !/^(blob|data):/.test(u)) external.push(u); });
  await page.goto('/codex/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('.brand')).toHaveText('CXTI');
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  const card = page.locator('#card svg');
  await expect(card).toContainText('CXTI');
  await expect(card).toContainText('CLPN');
  const sections = page.locator('#sections');
  await expect(sections).toContainText('Sessions compressées ignorées');
  await expect(sections).not.toContainText('Bloqués par le mode auto');
  await expect(sections).not.toContainText('Tours au-delà de 150 000 tokens');
  await expect(sections).not.toContainText('Cache reconstruit');
  await expect(page.locator('body')).not.toContainText('Claude');
  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#json')]);
  expect(json.suggestedFilename()).toBe('cxti-stats.json');
  expect(external).toEqual([]);
});

test('démo CXTI et illustrations servies depuis ../assets', async ({ page }) => {
  await page.goto('/codex/');
  const img = page.locator('#types-gallery img').first();
  await expect(img).toHaveJSProperty('complete', true);
  expect(await img.evaluate((e) => e.naturalWidth)).toBeGreaterThan(0);
  await page.click('#demo');
  await expect(page.locator('#card svg')).toContainText('Le Joueur de YOLO');
});

test('un dossier de fichiers compressés seulement : message explicite', async ({ page }) => {
  await page.goto('/codex/');
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex-zst');
  await expect(page.locator('#error')).toContainText('zstd -d');
  await expect(page.locator('#intro')).toBeVisible();
});

test('la page CCTI ne mène pas à la page Codex', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href*="codex"]')).toHaveCount(0);
});
