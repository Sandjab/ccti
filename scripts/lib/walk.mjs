// scripts/lib/walk.mjs — lecture d'un dossier ~/.claude/projects en Node (CLI et tests).
import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { Analyzer, projectFromSlug } from '../../src/analyzer.js';

export async function resolveRoot(dir) {
  let root = path.resolve(dir);
  if (path.basename(root) !== 'projects') {
    try { if ((await stat(path.join(root, 'projects'))).isDirectory()) root = path.join(root, 'projects'); } catch {}
  }
  return root;
}

export async function listSessionFiles(root) {
  const out = [];
  for (const slug of await readdir(root, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const dir = path.join(root, slug.name);
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.jsonl')) {
        out.push({ path: path.join(dir, e.name), slug: slug.name, kind: 'main', sessionId: e.name.slice(0, -6) });
      } else if (e.isDirectory()) {
        const sub = path.join(dir, e.name, 'subagents');
        let files = [];
        // récursif : les agents de workflow sont rangés sous subagents/workflows/wf_*/ (spec § 3.1)
        try { files = await readdir(sub, { recursive: true }); } catch { continue; }
        for (const f of files.sort()) if (f.endsWith('.jsonl')) out.push({ path: path.join(sub, f), slug: slug.name, kind: 'subagent', sessionId: e.name });
      }
    }
  }
  return out;
}

export async function analyzeDirectory(dir, onProgress) {
  const root = await resolveRoot(dir);
  const files = await listSessionFiles(root);
  const a = new Analyzer();
  let bytes = 0, done = 0;
  for (const f of files) {
    a.beginFile({ project: projectFromSlug(f.slug), kind: f.kind, sessionId: f.sessionId });
    const rl = createInterface({ input: createReadStream(f.path), crlfDelay: Infinity });
    for await (const line of rl) { bytes += line.length + 1; a.feedLine(line); }
    a.endFile();
    done++;
    if (onProgress && done % 100 === 0) onProgress({ done, total: files.length, bytes });
  }
  return { stats: a.result(), files: files.length, bytes };
}
