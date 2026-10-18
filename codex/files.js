// codex/files.js — tri des fichiers déposés (spec CXTI § 2.1). Le type de session (principale,
// sous-agent, interne) se lit dans la ligne session_meta, pas dans le chemin.
export const accept = (name) => name.endsWith('.jsonl') || name.endsWith('.jsonl.zst');

export function classify(entries) {
  const out = [];
  for (const { file, rel } of entries) {
    const name = String(rel).split(/[\\/]/).pop() || '';
    if (!name.startsWith('rollout-')) continue;
    if (name.endsWith('.jsonl')) out.push({ file, sessionId: name.slice(0, -6) });
    // compressé (zstd) : décompressé en flux par le worker (spec .zst § 4)
    else if (name.endsWith('.jsonl.zst')) out.push({ file, sessionId: name.slice(0, -10), zst: true });
  }
  return out; // entre une archive et son .jsonl, addBatch choisit (spec issue #2 § 3)
}
