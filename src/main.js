// src/main.js — la page : états, sélection du dossier, worker, rendu, exports, langue, thème.
// Chaque fichier déposé est rattaché à son outil ; un bilan par outil, avec un sélecteur (spec CCTI Claude+Codex § 4).
import { detectLang, t, fmtInt, setTool } from './i18n.js';
import { computeProfile } from './profile.js';
import { renderCard, CARD_W, CARD_H } from './card.js';
import { renderDiagnosis, renderSections, diagnosisTexts, renderGallery, h } from './render.js';
import { accept, addBatch, coverage } from './sources.js';
import { createWorker } from './worker-factory.js';
import DEMO_STATS from './demo.js';
import CODEX_DEMO from '../codex/demo.js';

const $ = (id) => document.getElementById(id);
const state = { lang: detectLang(), reports: null, tools: [], tool: 'claude', stats: null, profile: null, items: [], entries: [], coverage: null, result: null, worker: null, demo: false, startedAt: 0 };
// préfixe des fichiers exportés : inchangé pour Claude, « ccti-codex » pour Codex
const prefix = () => (state.tool === 'codex' ? 'ccti-codex' : 'ccti');

// ---------- thème et langue ----------
try { const th = localStorage.getItem('ccti.theme'); if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th; } catch {}
function currentTheme() {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark' || forced === 'light') return forced;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyI18n() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(state.lang, el.dataset.i18n);
  let tz = 'local';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch {}
  $('footer-text').textContent = t(state.lang, 'ui.footer', { tz });
  renderGallery($('types-gallery'), state.lang);
  if (state.stats) renderReport();
}
// Fichier hors ligne : les illustrations n'y sont pas, la galerie disparaît au premier échec.
$('types-gallery').addEventListener('ccti:missing', () => { $('types').hidden = true; });
$('lang').addEventListener('click', () => {
  state.lang = state.lang === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('ccti.lang', state.lang); } catch {}
  applyI18n();
});
$('theme').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ccti.theme', next); } catch {}
  if (state.stats) renderReport();
});

// ---------- états ----------
function show(id) { for (const s of document.querySelectorAll('.state')) s.hidden = s.id !== id; window.scrollTo(0, 0); }
function showError(msg) { const e = $('error'); e.textContent = msg || ''; e.hidden = !msg; }
function toast(msg) { $('toast').textContent = msg; setTimeout(() => { if ($('toast').textContent === msg) $('toast').textContent = ''; }, 2500); }

// ---------- collecte des fichiers ----------
// Le parcours d'un gros dossier (~/.claude entier) prend plusieurs secondes : on affiche l'état
// « progress » dès le début, avec le nombre de fichiers de session trouvés.
function beginScan() {
  state.scanning = true;
  showError('');
  $('bar').removeAttribute('value'); // barre indéterminée
  $('progress-text').textContent = t(state.lang, 'ui.scanning', { n: fmtInt(state.lang, 0) });
  show('progress');
}
function found(out, item) {
  out.push(item);
  if (out.length % 25 === 1) $('progress-text').textContent = t(state.lang, 'ui.scanning', { n: fmtInt(state.lang, out.length) });
}
function endScan(out) {
  if (!state.scanning) return; // annulé pendant le parcours
  state.scanning = false;
  start(out);
}
async function collectFromHandle(dir, prefix, out) {
  for await (const [name, handle] of dir.entries()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (!state.scanning) return;
    if (handle.kind === 'file') { if (accept(name)) found(out, { file: await handle.getFile(), rel }); }
    else if (name !== 'node_modules') await collectFromHandle(handle, rel, out);
  }
}
function collectFromEntry(entry, prefix, out) {
  return new Promise((resolve) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      if (!accept(entry.name)) return resolve();
      entry.file((f) => { found(out, { file: f, rel }); resolve(); }, () => resolve());
      return;
    }
    if (entry.name === 'node_modules' || !state.scanning) return resolve();
    const reader = entry.createReader();
    const all = [];
    const next = () => reader.readEntries(async (entries) => {
      if (!entries.length) { for (const e of all) await collectFromEntry(e, rel, out); return resolve(); }
      all.push(...entries);
      next();
    }, () => resolve());
    next();
  });
}
async function handleDrop(ev) {
  ev.preventDefault();
  $('drop').classList.remove('over');
  const items = [...(ev.dataTransfer.items || [])].filter((i) => i.kind === 'file');
  // Les items sont invalidés dès que le gestionnaire rend la main : tout saisir de façon synchrone.
  const pending = items.map((it) => (it.getAsFileSystemHandle ? { p: it.getAsFileSystemHandle() } : { e: it.webkitGetAsEntry ? it.webkitGetAsEntry() : null }));
  const out = [];
  beginScan();
  for (const x of pending) {
    if (x.p) {
      const hd = await x.p;
      if (hd && hd.kind === 'directory') await collectFromHandle(hd, hd.name, out);
      else if (hd && hd.kind === 'file' && accept(hd.name)) found(out, { file: await hd.getFile(), rel: hd.name });
    } else if (x.e) await collectFromEntry(x.e, '', out);
  }
  endScan(out);
}
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', handleDrop);
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
// Sélecteur de dossier : depuis l'accueil, ou depuis le bilan pour ajouter le dossier de l'autre outil.
async function pickFolder() {
  if (window.showDirectoryPicker) {
    try {
      const hd = await window.showDirectoryPicker({ mode: 'read' });
      const out = [];
      beginScan();
      await collectFromHandle(hd, hd.name, out);
      endScan(out);
    } catch (err) { state.scanning = false; if (!err || err.name !== 'AbortError') { show('intro'); showError(String((err && err.message) || err)); } }
  } else $('fallback').click();
}
$('pick').addEventListener('click', pickFolder);
$('add').addEventListener('click', pickFolder);
$('fallback').addEventListener('change', () => {
  const out = [...$('fallback').files].filter((f) => accept(f.name)).map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }));
  $('fallback').value = '';
  start(out);
});

// ---------- analyse ----------
function start(entries) {
  showError('');
  // Les items retenus ne changent qu'à l'arrivée d'un résultat : une analyse annulée ou en erreur
  // ne se mêle pas au dépôt suivant.
  const { items: files, added } = addBatch(state.items, entries);
  const examined = [...state.entries, ...entries]; // tout fichier .jsonl / .jsonl.zst collecté, pour le reçu (issue #1)
  if (!added) {
    if (state.reports) { // ajout sans rien de nouveau : bilan inchangé, mais le reçu compte les fichiers de ce lot
      if (state.result) { state.entries = examined; state.coverage = receipt(examined, state.items, state.result); renderCoverage(); }
      show('report'); toast(t(state.lang, 'ui.nothingAdded')); return;
    }
    show('intro'); showError(t(state.lang, 'ui.noFiles')); return;
  }
  state.demo = false; state.startedAt = Date.now();
  $('bar').value = 0; $('progress-text').textContent = '';
  show('progress');
  const w = createWorker();
  state.worker = w;
  w.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') {
      $('bar').value = d.total ? Math.round((100 * d.done) / d.total) : 0;
      $('progress-text').textContent = t(state.lang, 'ui.progress', {
        done: fmtInt(state.lang, d.done), total: fmtInt(state.lang, d.total), mb: fmtInt(state.lang, d.bytes / 1e6),
        sessions: fmtInt(state.lang, d.sessions), sec: Math.round((Date.now() - state.startedAt) / 1000),
      });
    } else if (d.type === 'result') { w.terminate(); state.worker = null; state.items = files; state.entries = examined; state.result = d; state.coverage = receipt(examined, files, d); setReports(d.reports); }
  };
  w.onerror = (err) => { w.terminate(); state.worker = null; back(); if (!state.reports) showError((err && err.message) || 'Worker error'); };
  w.postMessage({ type: 'start', files });
}
// Après une annulation ou une erreur : retour au bilan affiché s'il y en a un (ajout d'un dossier), sinon à l'accueil.
function back() { show(state.reports ? 'report' : 'intro'); }
$('cancel').addEventListener('click', () => { state.scanning = false; if (state.worker) { state.worker.terminate(); state.worker = null; } back(); });
// Outils affichés : ceux qui ont au moins une session (à défaut, tous) ; le plus fourni d'abord.
function setReports(reports) {
  state.reports = reports;
  const withSessions = Object.keys(reports).filter((k) => reports[k].volume.sessions > 0);
  state.tools = (withSessions.length ? withSessions : Object.keys(reports))
    .sort((a, b) => reports[b].volume.sessions - reports[a].volume.sessions);
  selectTool(state.tools[0]);
  show('report');
}
function selectTool(tool) {
  state.tool = tool;
  setTool(tool);
  state.stats = state.reports[tool];
  state.profile = computeProfile(state.stats);
  renderReport();
}
$('demo').addEventListener('click', () => { state.demo = true; state.coverage = null; state.result = null; setReports({ claude: DEMO_STATS, codex: CODEX_DEMO }); });
$('again').addEventListener('click', () => {
  Object.assign(state, { reports: null, tools: [], stats: null, profile: null, demo: false, items: [], entries: [], coverage: null, result: null });
  state.tool = 'claude'; setTool('claude');
  show('intro');
});

function renderReport() {
  const { stats, profile, lang } = state;
  $('demo-banner').hidden = !state.demo;
  $('add').hidden = state.demo;
  renderTools();
  renderCoverage();
  $('lowconf').hidden = !profile.lowConfidence;
  $('lowconf').textContent = t(lang, 'ui.lowConfidence', { n: fmtInt(lang, stats.volume.humanMessages) });
  const n = ++cardRenders;
  currentSvg().then((svg) => { if (n === cardRenders) $('card').innerHTML = svg; });
  renderDiagnosis($('diagnosis'), profile, lang);
  renderSections($('sections'), stats, lang);
}

// Sélecteur d'outil, seulement si deux bilans existent. Vidé (pas masqué) sinon : son texte ne doit
// pas rester dans la page d'un bilan à un seul outil.
function renderTools() {
  const tools = state.tools.length > 1 ? state.tools : [];
  $('tools').replaceChildren(...tools.map((k) => {
    const on = k === state.tool;
    const b = h('button', { type: 'button', class: on ? 'primary' : null, 'aria-pressed': String(on),
      text: t(state.lang, k === 'codex' ? 'ui.toolCodex' : 'ui.toolClaude', { n: fmtInt(state.lang, state.reports[k].volume.sessions) }) });
    b.addEventListener('click', () => selectTool(k));
    return b;
  }));
}

// Reçu de couverture (issue #1) : une catégorie par fichier examiné ; un fichier illisible quitte sa
// catégorie (outil, ou archives .jsonl.zst) pour la sienne, et la somme reste le nombre de fichiers examinés.
function receipt(entries, items, result) {
  const c = coverage(entries, items), u = result.unreadable || {};
  for (const [k, n] of Object.entries(u)) c[k] -= n;
  c.unreadable = Object.values(u).reduce((a, b) => a + b, 0);
  c.corruptLines = Object.values(result.reports).reduce((n, r) => n + r.volume.corruptLines, 0);
  return c;
}
function renderCoverage() {
  const c = state.coverage, L = (k) => t(state.lang, `ui.${k}`), n = (x) => fmtInt(state.lang, x);
  $('coverage').hidden = !c;
  if (!c) return;
  const sep = state.lang === 'fr' ? '\u00a0: ' : ': ';
  // Les catégories d'archives ne s'affichent que si elles comptent un fichier (le JSON exporté les garde).
  const parts = [['covClaude', c.claude], ['covCodex', c.codex], ['covCompressed', c.compressed], ['covDuplicates', c.duplicates], ['covIndex', c.index], ['covUnrecognized', c.unrecognized], ['covUnreadable', c.unreadable]]
    .filter(([k, v]) => v || (k !== 'covCompressed' && k !== 'covDuplicates'))
    .map(([k, v]) => `${L(k)}${sep}${n(v)}`).join(', ');
  const corrupt = c.corruptLines ? ` ${L('covCorrupt')}${sep}${n(c.corruptLines)}.` : '';
  $('coverage').textContent = `${L('covExamined')}${sep}${n(c.examined)} (${parts}).${corrupt} ${L('covScope')}`;
}

// ---------- carte ----------
// L'illustration est embarquée en data URI : le PNG est rendu depuis une URL data: qui ne charge
// aucune ressource externe. Absente du fichier hors ligne : la carte s'affiche sans elle.
const illustrations = new Map();
function illustration(lang, code) {
  const key = `${lang}/${code}`;
  if (!illustrations.has(key)) {
    illustrations.set(key, fetch(`assets/types/${key}.webp`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
      // type forcé : un serveur qui ne connaît pas .webp répond application/octet-stream
      .then((blob) => new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(new Blob([blob], { type: 'image/webp' })); }))
      .catch(() => null));
  }
  return illustrations.get(key);
}
let cardRenders = 0; // un changement de langue ou de thème rapide ne doit pas afficher une carte périmée
async function currentSvg() {
  const { stats, profile, lang } = state;
  return renderCard(stats, profile, { lang, theme: currentTheme(), image: await illustration(lang, profile.code) });
}

// ---------- exports ----------
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function svgToPng(svg, scale = 2, width = CARD_W, height = CARD_H) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // URL data: plutôt que blob: — les SVG à foreignObject chargés en blob: rendent le canvas
    // illisible (« tainted ») dans certains navigateurs.
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('SVG load failed'));
    img.src = url;
  });
}
// Bilan complet : le DOM affiché est cloné dans un SVG <foreignObject>, avec la feuille de style
// et les valeurs calculées des variables du thème, puis rendu en PNG. Aucune ressource externe.
async function reportSvg() {
  const src = $('report');
  const pad = 24;
  const inner = Math.ceil(src.getBoundingClientRect().width);
  const clone = src.cloneNode(true);
  clone.removeAttribute('id'); // pas de doublon d'id pendant la mesure
  clone.querySelector('.actions')?.remove();
  clone.querySelector('#tools')?.remove();
  clone.querySelector('#again')?.closest('p')?.remove();
  // Hauteur mesurée sur le clone (sans les boutons), posé hors écran à la même largeur.
  clone.style.cssText = `position:absolute;left:-100000px;top:0;width:${inner}px`;
  src.parentNode.append(clone);
  const height = Math.ceil(clone.getBoundingClientRect().height) + 2 * pad;
  clone.remove();
  clone.removeAttribute('style');
  const width = inner + 2 * pad;
  const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
  const vars = [...new Set(css.match(/--[\w-]+(?=\s*:)/g) || [])].map((n) => `${n}:${root.getPropertyValue(n)}`).join(';');
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const style = `${vars};background:${body.backgroundColor};color:${body.color};font-family:${body.fontFamily};font-size:${body.fontSize};line-height:${body.lineHeight};width:${width}px;height:${height}px;padding:${pad}px;box-sizing:border-box`;
  for (const img of clone.querySelectorAll('img')) {
    if (img.style.display === 'none') { img.remove(); continue; }
    try {
      const blob = await (await fetch(img.src)).blob();
      img.src = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
    } catch { img.remove(); }
  }
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="${xml(style).replace(/"/g, '&quot;')}"><style>${xml(css)}</style>${html}</div></foreignObject></svg>`;
  return { svg, width, height };
}
$('png').addEventListener('click', async () => {
  const svg = await currentSvg();
  try { download(`${prefix()}-${state.profile.code}.png`, await svgToPng(svg)); }
  catch { download(`${prefix()}-${state.profile.code}.svg`, new Blob([svg], { type: 'image/svg+xml' })); toast(t(state.lang, 'ui.svg')); }
});
$('png-full').addEventListener('click', async () => {
  const { svg, width, height } = await reportSvg();
  try { download(`${prefix()}-${state.profile.code}-full.png`, await svgToPng(svg, 2, width, height)); }
  catch { download(`${prefix()}-${state.profile.code}-full.svg`, new Blob([svg], { type: 'image/svg+xml' })); toast(t(state.lang, 'ui.svg')); }
});
$('json').addEventListener('click', () => download(`${prefix()}-stats.json`, new Blob([JSON.stringify({ stats: state.stats, profile: state.profile, coverage: state.coverage }, null, 2)], { type: 'application/json' })));
$('share').addEventListener('click', async () => {
  // Texte pour LinkedIn : le diagnostic affiché, puis le lien.
  const d = diagnosisTexts(state.profile, state.lang);
  const text = [t(state.lang, 'ui.shareIntro', { sessions: fmtInt(state.lang, state.stats.volume.sessions) }), '', t(state.lang, 'ui.shareHeader', { type: d.name }), '', d.text, '', ...d.items.map((x) => `• ${x}`), '', t(state.lang, 'ui.shareFooter')].join('\n');
  try { await navigator.clipboard.writeText(text); toast(t(state.lang, 'ui.copied')); } catch { toast(t(state.lang, 'ui.clipboardFail')); }
});

applyI18n();
show('intro');
