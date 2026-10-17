// src/main.js — la page : états, sélection du dossier, worker, rendu, exports, langue, thème.
import { detectLang, t, fmtInt } from './i18n.js';
import { computeProfile } from './profile.js';
import { renderCard } from './card.js';
import { renderDiagnosis, renderSections, diagnosisTexts } from './render.js';
import { classify } from './files.js';
import { createWorker } from './worker-factory.js';
import DEMO_STATS from './demo.js';

const $ = (id) => document.getElementById(id);
const state = { lang: detectLang(), stats: null, profile: null, worker: null, demo: false, startedAt: 0 };

// ---------- thème et langue ----------
try { const th = localStorage.getItem('freudiff.theme'); if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th; } catch {}
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
  if (state.stats) renderReport();
}
$('lang').addEventListener('click', () => {
  state.lang = state.lang === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('freudiff.lang', state.lang); } catch {}
  applyI18n();
});
$('theme').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('freudiff.theme', next); } catch {}
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
    if (handle.kind === 'file') { if (name.endsWith('.jsonl')) found(out, { file: await handle.getFile(), rel }); }
    else if (name !== 'node_modules') await collectFromHandle(handle, rel, out);
  }
}
function collectFromEntry(entry, prefix, out) {
  return new Promise((resolve) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      if (!entry.name.endsWith('.jsonl')) return resolve();
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
      else if (hd && hd.kind === 'file' && hd.name.endsWith('.jsonl')) found(out, { file: await hd.getFile(), rel: hd.name });
    } else if (x.e) await collectFromEntry(x.e, '', out);
  }
  endScan(out);
}
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', handleDrop);
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pick').click(); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
$('pick').addEventListener('click', async () => {
  if (window.showDirectoryPicker) {
    try {
      const hd = await window.showDirectoryPicker({ mode: 'read' });
      const out = [];
      beginScan();
      await collectFromHandle(hd, hd.name, out);
      endScan(out);
    } catch (err) { state.scanning = false; if (!err || err.name !== 'AbortError') { show('intro'); showError(String((err && err.message) || err)); } }
  } else $('fallback').click();
});
$('fallback').addEventListener('change', () => {
  const out = [...$('fallback').files].filter((f) => f.name.endsWith('.jsonl')).map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }));
  $('fallback').value = '';
  start(out);
});

// ---------- analyse ----------
function start(entries) {
  showError('');
  const files = classify(entries);
  if (!files.length) { show('intro'); showError(t(state.lang, 'ui.noFiles')); return; }
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
    } else if (d.type === 'result') { w.terminate(); state.worker = null; setResult(d.stats); }
  };
  w.onerror = (err) => { w.terminate(); state.worker = null; show('intro'); showError((err && err.message) || 'Worker error'); };
  w.postMessage({ type: 'start', files });
}
$('cancel').addEventListener('click', () => { state.scanning = false; if (state.worker) { state.worker.terminate(); state.worker = null; } show('intro'); });
function setResult(stats) { state.stats = stats; state.profile = computeProfile(stats); renderReport(); show('report'); }
$('demo').addEventListener('click', () => { state.demo = true; setResult(DEMO_STATS); });
$('again').addEventListener('click', () => { state.stats = null; state.profile = null; state.demo = false; show('intro'); });

function renderReport() {
  const { stats, profile, lang } = state;
  $('demo-banner').hidden = !state.demo;
  $('lowconf').hidden = !profile.lowConfidence;
  $('lowconf').textContent = t(lang, 'ui.lowConfidence', { n: fmtInt(lang, stats.volume.humanMessages) });
  $('card').innerHTML = renderCard(stats, profile, { lang, theme: currentTheme() });
  renderDiagnosis($('diagnosis'), profile, lang);
  renderSections($('sections'), stats, lang);
}

// ---------- exports ----------
const currentSvg = () => renderCard(state.stats, state.profile, { lang: state.lang, theme: currentTheme() });
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function svgToPng(svg, scale = 2, width = 1200, height = 630) {
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
function reportSvg() {
  const src = $('report');
  const pad = 24;
  const inner = Math.ceil(src.getBoundingClientRect().width);
  const clone = src.cloneNode(true);
  clone.removeAttribute('id'); // pas de doublon d'id pendant la mesure
  clone.querySelector('.actions')?.remove();
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
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="${xml(style).replace(/"/g, '&quot;')}"><style>${xml(css)}</style>${html}</div></foreignObject></svg>`;
  return { svg, width, height };
}
$('png').addEventListener('click', async () => {
  try { download(`freudiff-${state.profile.code}.png`, await svgToPng(currentSvg())); }
  catch { download(`freudiff-${state.profile.code}.svg`, new Blob([currentSvg()], { type: 'image/svg+xml' })); toast(t(state.lang, 'ui.svg')); }
});
$('png-full').addEventListener('click', async () => {
  const { svg, width, height } = reportSvg();
  try { download(`freudiff-${state.profile.code}-full.png`, await svgToPng(svg, 2, width, height)); }
  catch { download(`freudiff-${state.profile.code}-full.svg`, new Blob([svg], { type: 'image/svg+xml' })); toast(t(state.lang, 'ui.svg')); }
});
$('json').addEventListener('click', () => download('freudiff-stats.json', new Blob([JSON.stringify({ stats: state.stats, profile: state.profile }, null, 2)], { type: 'application/json' })));
$('share').addEventListener('click', async () => {
  // Texte pour LinkedIn : le diagnostic affiché, puis le lien.
  const d = diagnosisTexts(state.profile, state.lang);
  const text = [t(state.lang, 'ui.shareHeader', { type: d.name }), '', d.text, '', ...d.items.map((x) => `• ${x}`), '', t(state.lang, 'ui.shareFooter')].join('\n');
  try { await navigator.clipboard.writeText(text); toast(t(state.lang, 'ui.copied')); } catch { toast(t(state.lang, 'ui.clipboardFail')); }
});

applyI18n();
show('intro');
