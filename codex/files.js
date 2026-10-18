// codex/files.js — tri des fichiers déposés (spec CXTI § 2.1). Le type de session (principale,
// sous-agent, interne) se lit dans la ligne session_meta, pas dans le chemin.
export const accept = (name) => name.endsWith('.jsonl') || name.endsWith('.jsonl.zst');

export function classify(entries) {
  const out = [];
  for (const { file, rel } of entries) {
    const name = String(rel).split(/[\\/]/).pop() || '';
    if (!name.startsWith('rollout-')) continue;
    if (name.endsWith('.jsonl')) out.push({ file, sessionId: name.slice(0, -6) });
    // compressé (zstd) : non lu, compté pour le signaler (spec CXTI § 1, décision 7)
    else if (name.endsWith('.jsonl.zst')) out.push({ file, sessionId: name.slice(0, -10), skip: true });
  }
  return out;
}
