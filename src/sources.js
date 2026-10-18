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
