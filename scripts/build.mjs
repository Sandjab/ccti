// scripts/build.mjs — inline CSS + modules ES (réécrits en IIFE) → dist/ccti.html (spec § 7.3).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { wrap } from './lib/bundle.mjs';

const SHARED = ['src/patterns.js', 'src/pricing.js', 'src/analyzer.js', 'src/profile.js', 'src/i18n/fr.js', 'src/i18n/en.js',
  'codex/i18n.js', 'src/i18n.js', 'src/card.js', 'src/render.js'];
// Ordre : chaque module après ceux qu'il importe.
const TARGETS = [
  { html: 'index.html', out: 'dist/ccti.html', css: 'src/styles.css', script: 'src/main.js',
    modules: [...SHARED, 'src/files.js', 'codex/files.js', 'src/sources.js', 'src/demo.js', 'codex/demo.js', 'src/worker-factory.js', 'src/main.js'],
    worker: ['src/patterns.js', 'src/pricing.js', 'src/analyzer.js', 'codex/pricing.js', 'codex/analyzer.js', 'vendor/fzstd.js', 'src/worker-core.js', 'src/worker.js'] },
];

async function bundle(list) { let out = ''; for (const f of list) out += wrap(f, await readFile(f, 'utf8')); return out; }
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const css = await readFile('src/styles.css', 'utf8');
await mkdir('dist', { recursive: true });
for (const t of TARGETS) {
  const workerSrc = safe(await bundle(t.worker));
  const mainSrc = safe(await bundle(t.modules));
  const cssTag = `<link rel="stylesheet" href="${t.css}">`, scriptTag = `<script type="module" src="${t.script}"></script>`;
  let html = await readFile(t.html, 'utf8');
  // Remplacement par fonction : avec une chaîne, `$\`` et `$$` dans le code inliné seraient interprétés par String.replace.
  html = html.replace(cssTag, () => `<style>\n${css}\n</style>`);
  html = html.replace(scriptTag, () => `<script>\nglobalThis.CCTI_WORKER_SRC = ${JSON.stringify(workerSrc)};\n${mainSrc}\n</script>`);
  if (html.includes(scriptTag) || html.includes(cssTag)) throw new Error(`${t.html} : inline incomplet`);
  await writeFile(t.out, html);
  console.log(`${t.out} : ${(html.length / 1024).toFixed(0)} Ko`);
}
