// src/sources.js — rattache chaque fichier déposé à son outil, Claude Code ou Codex
// (spec CCTI Claude+Codex § 2). Les deux tris existants font le travail ; ce module les réunit.
import { classify as classifyClaude } from './files.js';
import { classify as classifyCodex } from '../codex/files.js';

export const accept = (name) => name.endsWith('.jsonl') || name.endsWith('.jsonl.zst');

export function classify(entries) {
  const codex = classifyCodex(entries).map((it) => ({ ...it, tool: 'codex' }));
  let claude = classifyClaude(entries);
  // Avec des fichiers Codex dans le dépôt, un fichier n'est Claude que sous projects/ :
  // ~/.codex/history.jsonl ou un dossier de jour Codex ne doivent pas passer pour des sessions Claude.
  if (codex.length) {
    const inProjects = new Set(entries.filter((e) => String(e.rel).split(/[\\/]/).includes('projects')).map((e) => e.file));
    claude = claude.filter((it) => inProjects.has(it.file));
  }
  return [...claude.map((it) => ({ ...it, tool: 'claude' })), ...codex];
}

// Clé d'un fichier : un même fichier atteint par deux chemins (dossier enfant puis parent) n'est compté qu'une fois.
const keyOf = (f) => `${f.name}:${f.size}:${f.lastModified}`;

// « Ajouter un dossier » : chaque lot déposé est trié seul, avec son propre contexte (racine, projects/),
// puis ajouté aux items déjà retenus. Un ajout ne reclasse jamais les fichiers d'un lot précédent.
// added = nombre de fichiers lisibles nouveaux (hors doublons et fichiers compressés).
export function addBatch(items, entries) {
  const seen = new Set(items.map((it) => keyOf(it.file)));
  const out = [...items];
  let added = 0;
  for (const it of classify(entries)) {
    const k = keyOf(it.file);
    if (seen.has(k)) continue;
    seen.add(k); out.push(it);
    if (!it.skip) added++;
  }
  return { items: out, added };
}

// Fichiers d'historique ou d'index connus (Claude Code et Codex) : ce ne sont pas des sessions.
const INDEX = new Set(['history.jsonl', 'session_index.jsonl']);

// Reçu de couverture (issue #1) : chaque fichier examiné, compté une fois, tombe dans une seule catégorie.
// Seulement des nombres : aucun nom, chemin ni identifiant.
export function coverage(entries, items) {
  const byKey = new Map(items.map((it) => [keyOf(it.file), it]));
  const seen = new Set();
  const c = { examined: 0, claude: 0, codex: 0, compressed: 0, index: 0, unrecognized: 0 };
  for (const { file } of entries) {
    const k = keyOf(file);
    if (seen.has(k)) continue;
    seen.add(k); c.examined++;
    const it = byKey.get(k);
    if (it) c[it.skip ? 'compressed' : it.tool]++;
    else if (INDEX.has(file.name)) c.index++;
    else c.unrecognized++;
  }
  return c;
}
