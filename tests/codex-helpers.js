// tests/codex-helpers.js — analyse d'un dossier de sessions Codex en Node, comme le fait le worker
// (pas un fichier de test : il n'est pas lancé seul).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CodexAnalyzer } from '../codex/analyzer.js';
import { classify } from '../codex/files.js';
import { decompress } from '../vendor/fzstd.js';

export function analyzeDir(dir) {
  const rels = readdirSync(dir, { recursive: true }).map((f) => f.split(path.sep).join('/')).sort();
  const a = new CodexAnalyzer();
  for (const it of classify(rels.map((rel) => ({ file: path.join(dir, rel), rel })))) {
    // comme le worker : une archive est décompressée ; illisible, elle n'apporte rien au parseur
    let text;
    try { const raw = readFileSync(it.file); text = new TextDecoder().decode(it.zst ? decompress(raw) : raw); } catch { continue; }
    a.beginFile({ sessionId: it.sessionId });
    for (const line of text.split('\n')) a.feedLine(line);
    a.endFile();
  }
  return a.result();
}
