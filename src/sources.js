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

// Identité d'un fichier de session, stable quand il grandit (spec issue #2 § 3). Les fichiers de
// sous-agents Claude partagent le sessionId de leur session parente : leur nom les distingue.
const identity = (it) => (it.tool === 'codex' ? `codex:${it.sessionId}` : `claude:${it.slug}:${it.kind}:${it.sessionId}:${it.file.name}`);
// a vaut-il mieux que b, à identité égale ? Le .jsonl l'emporte sur l'archive, puis le plus récent,
// puis le plus gros ; à égalité, b (déjà retenu) reste (spec issue #2, décision 2).
function better(a, b) {
  if (!a.zst !== !b.zst) return !a.zst;
  if (a.file.lastModified !== b.file.lastModified) return a.file.lastModified > b.file.lastModified;
  return a.file.size > b.file.size;
}

// « Ajouter un dossier » : chaque lot déposé est trié seul, avec son propre contexte (racine, projects/),
// puis ajouté aux items déjà retenus. Un ajout ne reclasse jamais les fichiers d'un lot précédent.
// Une session n'est retenue qu'une fois par identité (spec issue #2 § 3).
// added : items nouveaux ou remplaçants ; touched : leurs outils ; dups : clés des fichiers mis de côté.
export function addBatch(items, entries) {
  const seen = new Set(items.map((it) => keyOf(it.file)));
  const byId = new Map(items.map((it) => [identity(it), it]));
  const fresh = new Set();
  const dups = [];
  for (const it of classify(entries)) {
    const k = keyOf(it.file);
    if (seen.has(k)) continue; // même fichier atteint par deux chemins
    seen.add(k);
    const id = identity(it), held = byId.get(id);
    if (held && !better(it, held)) { dups.push(k); continue; }
    if (held) { dups.push(keyOf(held.file)); fresh.delete(held); }
    byId.set(id, it); fresh.add(it);
  }
  return { items: [...byId.values()], added: fresh.size, touched: new Set([...fresh].map((it) => it.tool)), dups };
}

// Fichiers d'historique ou d'index connus (Claude Code et Codex) : ce ne sont pas des sessions.
const INDEX = new Set(['history.jsonl', 'session_index.jsonl']);

// Reçu de couverture (issue #1) : chaque fichier examiné, compté une fois, tombe dans une seule catégorie.
// Seulement des nombres : aucun nom, chemin ni identifiant.
export function coverage(entries, items, dups = []) {
  const byKey = new Map(items.map((it) => [keyOf(it.file), it]));
  const dup = new Set(dups);
  const seen = new Set();
  const c = { examined: 0, claude: 0, codex: 0, compressed: 0, duplicates: 0, index: 0, unrecognized: 0 };
  for (const { file } of entries) {
    const k = keyOf(file);
    if (seen.has(k)) continue;
    seen.add(k); c.examined++;
    const it = byKey.get(k);
    if (it) c[it.zst ? 'compressed' : it.tool]++;
    else if (dup.has(k)) c.duplicates++; // doublon d'une session déjà lue (spec issue #2 § 3)
    else if (INDEX.has(file.name)) c.index++;
    else c.unrecognized++;
  }
  return c;
}

// Catégories d'illisibles du reçu, par outil.
const UNREADABLE = { claude: ['claude'], codex: ['codex', 'compressed'] };

// Un ajout ne relit que les outils touchés : bilans et illisibles des autres outils sont repris du
// résultat précédent (spec issue #2 § 4). prev nul : premier dépôt.
export function mergeRuns(prev, next, touched) {
  if (!prev) return { reports: next.reports, unreadable: next.unreadable || {} };
  const reports = {}, unreadable = {};
  for (const [tool, r] of Object.entries(prev.reports)) if (!touched.has(tool)) reports[tool] = r;
  for (const [tool, cats] of Object.entries(UNREADABLE)) {
    if (touched.has(tool)) continue;
    for (const k of cats) if (prev.unreadable && prev.unreadable[k]) unreadable[k] = prev.unreadable[k];
  }
  Object.assign(reports, next.reports);
  Object.assign(unreadable, next.unreadable || {});
  return { reports, unreadable };
}
