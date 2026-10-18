// src/worker-core.js — boucle du Web Worker, commune à CCTI et CXTI : lecture en streaming,
// analyseur, progression (spec § 7.1 ; spec CXTI § 3.3).
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

export function runWorker(makeAnalyzer, fileInfo) {
  self.onmessage = async (e) => {
    if (!e.data || e.data.type !== 'start') return;
    const items = e.data.files;
    const a = makeAnalyzer();
    let bytes = 0, done = 0, last = 0;
    const progress = (force) => {
      const now = Date.now();
      if (!force && now - last < 50) return;
      last = now;
      self.postMessage({ type: 'progress', done, total: items.length, bytes, sessions: a.s.sessions });
    };
    for (const it of items) {
      if (it.skip) { a.skipFile(it); done++; continue; } // fichier reconnu mais illisible ici (.zst)
      a.beginFile(fileInfo(it));
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
    self.postMessage({ type: 'result', stats: a.result(), bytes });
  };
}
