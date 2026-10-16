// tests/e2e/scan.spec.js — pendant le parcours d'un gros dossier (sélecteur ou glisser-déposer),
// la page doit montrer qu'elle travaille : sans retour, ~/.claude entier ressemble à une page figée.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'tests/fixtures/projects';
const FILES = readdirSync(ROOT, { recursive: true })
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => ({ rel: f.split(path.sep).join('/'), text: readFileSync(path.join(ROOT, f), 'utf8') }));

test('sélecteur de dossier : état « parcours » visible avant l\'analyse', async ({ page }) => {
  // Faux showDirectoryPicker : arborescence en mémoire, 150 ms par entrée pour simuler un gros dossier.
  await page.addInitScript((files) => {
    const tree = { kind: 'directory', name: 'projects', children: new Map() };
    for (const { rel, text } of files) {
      const parts = rel.split('/'); let node = tree;
      for (const p of parts.slice(0, -1)) {
        if (!node.children.has(p)) node.children.set(p, { kind: 'directory', name: p, children: new Map() });
        node = node.children.get(p);
      }
      const name = parts.at(-1);
      node.children.set(name, { kind: 'file', name, text });
    }
    const wrap = (n) => n.kind === 'file'
      ? { kind: 'file', name: n.name, getFile: async () => new File([n.text], n.name) }
      : { kind: 'directory', name: n.name, async *entries() {
          for (const [k, c] of n.children) { await new Promise((r) => setTimeout(r, 150)); yield [k, wrap(c)]; }
        } };
    window.showDirectoryPicker = async () => wrap(tree);
  }, FILES);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#progress')).toBeVisible({ timeout: 1000 });
  await expect(page.locator('#progress-text')).toContainText(/trouvé|found/);
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLID');
});
