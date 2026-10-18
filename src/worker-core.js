// src/worker-core.js — boucle du Web Worker : lecture en streaming, un analyseur par outil,
// progression (spec § 7.1 ; spec CCTI Claude+Codex § 3).
async function readLines(file, onLine, onBytes) {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
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
    const items = e.data.files;
    const analyzers = new Map();
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
    for (const it of items) {
      const a = of(it.tool);
      if (it.skip) { a.skipFile(it); done++; continue; } // fichier reconnu mais illisible ici (.zst)
      a.beginFile(tools[it.tool].info(it));
      try {
        await readLines(it.file, (line) => a.feedLine(line), (n) => { bytes += n; progress(false); });
      } catch {
        a.s.corruptLines++;            // fichier illisible : on passe au suivant
      }
      a.endFile();
      done++;
      progress(false);
    }
    progress(true);
    const reports = {};
    for (const [tool, a] of analyzers) reports[tool] = a.result();
    self.postMessage({ type: 'result', reports, bytes });
  };
}
