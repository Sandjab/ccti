// tests/codex-helpers.js — analyse d'un dossier de sessions Codex en Node, comme le fait le worker
// (pas un fichier de test : il n'est pas lancé seul).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { CodexAnalyzer } from '../codex/analyzer.js';
import { addBatch } from '../src/sources.js';
import { decompress } from '../vendor/fzstd.js';

export function analyzeDir(dir) {
  const rels = readdirSync(dir, { recursive: true }).map((f) => f.split(path.sep).join('/')).sort()
    .filter((rel) => statSync(path.join(dir, rel)).isFile());
  // Comme la page : addBatch trie les fichiers et choisit entre une archive et son .jsonl (spec issue #2 § 3).
  const entries = rels.map((rel) => {
    const full = path.join(dir, rel), s = statSync(full);
    return { file: { name: path.basename(rel), size: s.size, lastModified: s.mtimeMs, path: full }, rel };
  });
  const a = new CodexAnalyzer();
  for (const it of addBatch([], entries).items.filter((o) => o.tool === 'codex')) {
    // comme le worker : une archive est décompressée, et n'apporte rien si elle est illisible. Un .jsonl
    // illisible, que le worker compte en session fantôme, n'arrive pas ici : les fixtures sont sur disque.
    let text;
    try { const raw = readFileSync(it.file.path); text = new TextDecoder().decode(it.zst ? decompress(raw) : raw); } catch { continue; }
    a.beginFile({ sessionId: it.sessionId });
    for (const line of text.split('\n')) a.feedLine(line);
    a.endFile();
  }
  return a.result();
}
