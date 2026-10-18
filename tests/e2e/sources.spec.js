// tests/e2e/sources.spec.js — une page, deux outils (spec CCTI Claude+Codex § 8) : détection,
// sélecteur, « Ajouter un dossier », textes et exports par outil, aucune requête externe.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const read = (root, prefix) => readdirSync(root, { recursive: true })
  .filter((f) => statSync(path.join(root, f)).isFile())
  .map((f) => ({ rel: prefix + f.split(path.sep).join('/'), text: readFileSync(path.join(root, f), 'utf8') }));
const CLAUDE = read('tests/fixtures/projects', '.claude/projects/');
const CODEX = read('tests/fixtures-codex', '.codex/');
const ZST_ONLY = read('tests/fixtures-codex-zst', '.codex/');

// Faux showDirectoryPicker : l'arborescence est construite en mémoire à partir de { rel, text }.
// Chaque appel prend le lot suivant (« Ajouter un dossier » rouvre le sélecteur).
async function stubPicker(page, ...batches) {
  await page.addInitScript((batches) => {
    let call = 0;
    window.showDirectoryPicker = async () => {
      const files = batches[Math.min(call++, batches.length - 1)];
      const tree = { kind: 'directory', name: 'home', children: new Map() };
      for (const { rel, text } of files) {
        const parts = rel.split('/'); let node = tree;
        for (const p of parts.slice(0, -1)) {
          if (!node.children.has(p)) node.children.set(p, { kind: 'directory', name: p, children: new Map() });
          node = node.children.get(p);
        }
        node.children.set(parts.at(-1), { kind: 'file', name: parts.at(-1), text });
      }
      let t = 0;
      const wrap = (n) => n.kind === 'file'
        ? { kind: 'file', name: n.name, getFile: async () => new File([n.text], n.name, { lastModified: 1_700_000_000_000 + (t++) }) }
        : { kind: 'directory', name: n.name, async *entries() { for (const [k, c] of n.children) yield [k, wrap(c)]; } };
      return wrap(tree);
    };
  }, batches);
}
const external = (page) => {
  const urls = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== '127.0.0.1:8765' && u.protocol !== 'blob:' && u.protocol !== 'data:') urls.push(r.url()); });
  return urls;
};

test('Codex seul : bilan Codex, pas de sélecteur, exports ccti-codex', async ({ page }) => {
  const urls = external(page);
  await page.goto('/');
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await expect(page.locator('#card svg')).toContainText('Claude and Codex Type Indicator · Codex');
  await expect(page.locator('#diagnosis')).not.toContainText('Claude');
  await expect(page.locator('#sections')).not.toContainText('Claude');
  await expect(page.locator('#sections')).toContainText('Sessions compressées ignorées');
  await expect(page.locator('#sections')).not.toContainText('Bloqués par le mode auto');
  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#json')]);
  expect(json.suggestedFilename()).toBe('ccti-codex-stats.json');
  expect(urls).toEqual([]);
});

test('dépôt mixte : sélecteur, bascule, langue, exports par outil', async ({ page }) => {
  await stubPicker(page, [...CLAUDE, ...CODEX]);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  const buttons = page.locator('#tools button');
  await expect(buttons).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#card svg')).toContainText('CLID');
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await expect(page.locator('#card svg')).toContainText('· Codex');
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#png')]);
  expect(png.suggestedFilename()).toBe('ccti-codex-CLPN.png');
  await page.click('#lang');                                    // la langue change, l'outil reste Codex
  await expect(page.locator('#card svg')).toContainText('The Night Surgeon');
  await expect(page.locator('#diagnosis')).not.toContainText('Claude');
  await page.locator('#tools button').nth(0).click();
  await expect(page.locator('#card svg')).toContainText('CLID');
  await expect(page.locator('#card svg')).toContainText('· Claude Code');
});

test('Claude + Codex compressé seulement : pas d\'onglet Codex vide', async ({ page }) => {
  await stubPicker(page, [...CLAUDE, ...ZST_ONLY]);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await expect(page.locator('#card svg')).toContainText('CLID');
});

test('Ajouter un dossier : Claude puis Codex, et un dossier déjà vu n\'est pas recompté', async ({ page }) => {
  await stubPicker(page, CLAUDE, CODEX, CLAUDE);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await page.click('#add');
  await expect(page.locator('#tools button')).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
  await page.click('#add');                                     // le même dossier Claude, une seconde fois
  await expect(page.locator('#tools button')).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
});

test('démo : deux bilans, et « Analyser un autre dossier » remet les textes Claude', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  await expect(page.locator('#tools button')).toHaveCount(2);
  await expect(page.locator('#add')).toBeHidden();
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  await page.locator('#tools button').nth(1).click();
  await expect(page.locator('#card svg')).toContainText('Le Joueur de YOLO');
  await page.click('#again');
  await page.locator('#fallback').setInputFiles('tests/fixtures/projects');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('Claude vous a donné raison');
});

test('la page /codex/ n\'existe plus', async ({ page }) => {
  const r = await page.goto('/codex/');
  expect(r.status()).toBe(404);
});

// Fait taire le worker numéro `n` (0 = premier) : l'analyse reste en cours, le temps de cliquer « Annuler ».
async function hangWorker(page, n) {
  await page.addInitScript((n) => {
    const W = window.Worker; let i = 0;
    window.Worker = function (...a) { const w = new W(...a); if (i++ === n) w.postMessage = () => {}; return w; };
  }, n);
}

// Revue de branche, Important 1 : un dépôt annulé ne doit pas se mêler au dépôt suivant.
test('annuler une analyse puis déposer un autre dossier : rien de l\'analyse annulée', async ({ page }) => {
  await hangWorker(page, 0);
  await stubPicker(page, CLAUDE);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#progress')).toBeVisible();
  await page.click('#cancel');
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await expect(page.locator('#card svg')).toContainText('CLPN');
});

test('annuler pendant « Ajouter un dossier » : retour au bilan affiché', async ({ page }) => {
  await hangWorker(page, 1);
  await stubPicker(page, CLAUDE, CODEX);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await page.click('#add');
  await expect(page.locator('#progress')).toBeVisible();
  await page.click('#cancel');
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#card svg')).toContainText('CLID');
  await expect(page.locator('#tools button')).toHaveCount(0);
});

// Revue de branche, Important 3 : un ajout sans session lisible le dit, et le bilan reste.
test('ajouter un dossier Codex compressé seulement : message, bilan inchangé', async ({ page }) => {
  await stubPicker(page, CLAUDE, ZST_ONLY);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await page.click('#add');
  await expect(page.locator('#toast')).toContainText('zstd -d');
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#card svg')).toContainText('CLID');
});
