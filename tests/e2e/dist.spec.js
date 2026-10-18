// tests/e2e/dist.spec.js — le fichier autonome fonctionne en file:// sans aucune requête.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

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

// Spec § 8 : dépôt mixte dans le fichier autonome. Faux sélecteur de dossier (Claude + Codex), en mémoire.
test('dist/ccti.html : dépôt mixte Claude + Codex en file://', async ({ page }) => {
  const read = (root, prefix) => readdirSync(root, { recursive: true }).filter((f) => statSync(path.join(root, f)).isFile())
    .map((f) => ({ rel: prefix + f.split(path.sep).join('/'), text: readFileSync(path.join(root, f), 'utf8') }));
  const files = [...read('tests/fixtures/projects', '.claude/projects/'), ...read('tests/fixtures-codex', '.codex/')];
  await page.addInitScript((files) => {
    window.showDirectoryPicker = async () => {
      const tree = { kind: 'directory', name: 'home', children: new Map() };
      for (const { rel, text } of files) {
        const parts = rel.split('/'); let node = tree;
        for (const p of parts.slice(0, -1)) { if (!node.children.has(p)) node.children.set(p, { kind: 'directory', name: p, children: new Map() }); node = node.children.get(p); }
        node.children.set(parts.at(-1), { kind: 'file', name: parts.at(-1), text });
      }
      const wrap = (n) => n.kind === 'file' ? { kind: 'file', name: n.name, getFile: async () => new File([n.text], n.name) }
        : { kind: 'directory', name: n.name, async *entries() { for (const [k, c] of n.children) yield [k, wrap(c)]; } };
      return wrap(tree);
    };
  }, files);
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.click('#pick');
  await expect(page.locator('#tools button')).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions'], { timeout: 30_000 });
  await page.locator('#tools button').nth(1).click();
  await expect(page.locator('#card svg')).toContainText('CLPN');
  expect(urls).toEqual([]);
});

// spec .zst : le worker Blob du fichier autonome décompresse une vraie archive, sans requête.
test('dist/ccti.html : une session .jsonl.zst est lue en file://', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex-zst');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('· Codex');
  await expect(page.locator('#coverage')).toContainText('archives .jsonl.zst décompressées : 1');
  expect(urls).toEqual([]);
});
