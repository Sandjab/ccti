// src/worker-core.js — boucle du Web Worker : lecture en streaming, un analyseur par outil,
// progression (spec § 7.1 ; spec CCTI Claude+Codex § 3).
import { Decompress } from '../vendor/fzstd.js';

// Flux zstd → octets décompressés (spec .zst § 3). fzstd lève une erreur sur un flux faux ou tronqué ;
// elle remonte jusqu'au try/catch de runWorker, qui compte le fichier illisible.
function unzstd() {
  let d;
  return new TransformStream({
    start(ctl) { d = new Decompress((chunk) => { if (chunk.length) ctl.enqueue(chunk); }); },
    transform(chunk) { d.push(chunk); },
    flush() { d.push(new Uint8Array(0), true); },
  });
}

// Une archive est d'abord décompressée à vide, jusqu'au bout : tronquée ou fausse, elle est écartée avant
// toute lecture, sans laisser dans le bilan le début déjà décompressé (revue de branche, mineur 1).
async function intact(file) {
  try {
    const reader = file.stream().pipeThrough(unzstd()).getReader();
    while (!(await reader.read()).done);
    return true;
  } catch {
    return false;
  }
}

async function readLines(file, onLine, onBytes, zst) {
  const bytes = zst ? file.stream().pipeThrough(unzstd()) : file.stream();
  const reader = bytes.pipeThrough(new TextDecoderStream()).getReader();
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onBytes(value.length);
    let start = 0, idx;
    while ((idx = value.indexOf('\n', start)) >= 0) {
      onLine(rest + value.slice(start, idx));
      rest = '';
      start = idx + 1;
    }
    rest += value.slice(start);
  }
  if (rest) onLine(rest);
}

// tools : { claude: { make, info }, codex: { make, info } } — un analyseur par outil présent dans le dépôt,
// créé au premier fichier de cet outil ; le résultat garde un bilan par outil (spec CCTI Claude+Codex § 3).
export function runWorker(tools) {
  self.onmessage = async (e) => {
    if (!e.data || e.data.type !== 'start') return;
    // Une exception dans cette fonction async (bug d'un analyseur) ne déclencherait aucun événement d'erreur
    // côté page : elle est envoyée comme message, et la page la signale (revue du lot #3/#10).
    try { await analyze(e.data.files); } catch (err) { self.postMessage({ type: 'error', message: String((err && err.message) || err) }); }
  };
  async function analyze(items) {
    const analyzers = new Map();
    const unreadable = {}; // fichiers illisibles, par catégorie du reçu (issue #1)
    const of = (tool) => { if (!analyzers.has(tool)) analyzers.set(tool, tools[tool].make()); return analyzers.get(tool); };
    let bytes = 0, done = 0, last = 0;
    const progress = (force) => {
      const now = Date.now();
      if (!force && now - last < 50) return;
      last = now;
      let sessions = 0;
      for (const a of analyzers.values()) sessions += a.s.sessions;
      self.postMessage({ type: 'progress', done, total: items.length, bytes, sessions });
    };
    const unread = (it) => { const k = it.zst ? 'compressed' : it.tool; unreadable[k] = (unreadable[k] || 0) + 1; }; // catégorie du reçu (spec .zst § 4)
    for (const it of items) {
      const a = of(it.tool);
      if (it.zst && !(await intact(it.file))) { unread(it); done++; progress(false); continue; }
      a.beginFile(tools[it.tool].info(it));
      try {
        await readLines(it.file, (line) => a.feedLine(line), (n) => { bytes += n; progress(false); }, it.zst);
      } catch {
        unread(it); // fichier illisible : compté, puis on passe au suivant
      }
      a.endFile();
      done++;
      progress(false);
    }
    progress(true);
    const reports = {};
    for (const [tool, a] of analyzers) reports[tool] = a.result();
    self.postMessage({ type: 'result', reports, unreadable, bytes });
  }
}
