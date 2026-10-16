// src/files.js — classement des fichiers déposés en sessions principales / sous-agents (spec § 3.1).
// entries : [{ file, rel }] avec rel relatif au dossier déposé, séparateur '/'.
export function classify(entries) {
  if (!entries.length) return [];
  const split = (rel) => String(rel).split(/[\\/]/).filter(Boolean);
  const first = split(entries[0].rel)[0];
  // Racine commune (nom du dossier déposé) : retirée seulement si toutes les entrées la partagent
  // et ont au moins 3 segments (sinon c'est un slug de projet unique).
  const stripRoot = entries.every((e) => { const p = split(e.rel); return p[0] === first && p.length >= 3; });
  // Dossier parent déposé (~/.claude) : seuls les fichiers sous projects/ sont des sessions
  // (history.jsonl et consorts sont ignorés).
  const hasProjects = entries.some((e) => (stripRoot ? split(e.rel).slice(1) : split(e.rel)).includes('projects'));
  const out = [];
  for (const { file, rel } of entries) {
    let parts = split(rel);
    if (stripRoot) parts = parts.slice(1);
    const pi = parts.indexOf('projects');
    if (pi >= 0) parts = parts.slice(pi + 1);
    else if (hasProjects) continue;
    const last = parts[parts.length - 1] || '';
    if (parts.length < 2 || !last.endsWith('.jsonl')) continue;
    if (parts.length === 2) out.push({ file, slug: parts[0], kind: 'main', sessionId: last.slice(0, -6) });
    else if (parts.length >= 4 && parts[2] === 'subagents') out.push({ file, slug: parts[0], kind: 'subagent', sessionId: parts[1] });
  }
  return out;
}
