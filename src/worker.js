// src/worker.js — Web Worker : lecture en streaming, Analyzer, progression (spec § 7.1).
import { Analyzer, projectFromSlug } from './analyzer.js';

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

self.onmessage = async (e) => {
  if (!e.data || e.data.type !== 'start') return;
  const items = e.data.files;
  const a = new Analyzer();
  let bytes = 0, done = 0, last = 0;
  const progress = (force) => {
    const now = Date.now();
    if (!force && now - last < 50) return;
    last = now;
    self.postMessage({ type: 'progress', done, total: items.length, bytes, sessions: a.s.sessions });
  };
  for (const it of items) {
    a.beginFile({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId });
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
