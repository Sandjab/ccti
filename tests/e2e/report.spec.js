// tests/e2e/report.spec.js — export du bilan complet et mise en page de la facture.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1280, height: 900 } });

// La facture a 6 colonnes : dans une case de la grille à 3 colonnes elle forçait un défilement
// horizontal. Elle passe en dernier, sur toute la largeur ; sa case est libérée.
test('la facture est la dernière section, pleine largeur, sans défilement horizontal', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  const last = page.locator('#sections > .section').last();
  await expect(last.locator('h2')).toHaveText('La facture');
  const [w, grid] = await Promise.all([last.evaluate((e) => e.getBoundingClientRect().width), page.locator('#sections').evaluate((e) => e.getBoundingClientRect().width)]);
  expect(Math.abs(w - grid)).toBeLessThan(2);
  const overflow = await last.locator('.table-wrap').evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// Le PNG de la carte ne montre que trois chiffres : on veut aussi pouvoir partager le bilan entier.
test('télécharger le bilan complet en PNG', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#png-full')]);
  expect(dl.suggestedFilename()).toBe('freudiff-AVPN-full.png');
  const buf = readFileSync(await dl.path());
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  const reportW = await page.locator('#report').evaluate((e) => e.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(Math.floor(reportW * 2)); // rendu ×2, marges comprises
  expect(height).toBeGreaterThan(width); // tout le bilan, pas seulement la carte
});

test('boutons : plus de copie d\'image, texte pour LinkedIn', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  await expect(page.locator('#copy')).toHaveCount(0);
  await expect(page.locator('#share')).toHaveText('Copier le texte pour LinkedIn');
});

// Le bloc Gaspillage prend la case libérée par la facture, juste avant elle.
test('bloc Gaspillage avant la facture, dans la grille', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  const sections = page.locator('#sections > .section');
  const n = await sections.count();
  const waste = sections.nth(n - 2);
  await expect(waste.locator('h2')).toHaveText('Gaspillage');
  await expect(waste).not.toHaveClass(/wide/);
  await expect(waste).toContainText('150 000 tokens');
  await expect(waste).toContainText('pause');
});

// Le bouton LinkedIn copie le diagnostic tel qu'affiché (type, texte, observations) et le lien.
test('le bouton LinkedIn copie le diagnostic', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.click('#demo');
  await page.click('#share');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  await expect(page.locator('#diagnosis .type-name')).toHaveText("L'Architecte noctambule (AVPN)");
  expect(text).toContain("L'Architecte noctambule (AVPN)");
  expect(text).toContain(await page.locator('#diagnosis .type-text').textContent());
  for (const li of await page.locator('#diagnosis li').allTextContents()) expect(text).toContain(`• ${li}`);
  expect(text).toContain('https://sandjab.github.io/freudiff');
});

// Positionnement : un test de personnalité à 16 types, plus la métaphore du divan.
test('accueil : test de personnalité à 16 types, sans divan, en FR et en EN', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('16 types');
  await expect(page.locator('body')).not.toContainText(/\bdivan\b/i);
  await page.click('#lang');
  await expect(page.locator('h1')).toContainText('16-type');
  await expect(page.locator('body')).not.toContainText(/\bcouch\b/i);
});
