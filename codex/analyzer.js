// codex/analyzer.js — CodexAnalyzer : lignes rollout de Codex → même schéma de stats que CCTI
// (spec CXTI § 2 et § 4). Les comptages communs (message humain, texte du modèle, outils, commandes)
// sont ceux de l'Analyzer ; seule la lecture du format change.
import { Analyzer, basename } from '../src/analyzer.js';
import { costUsd } from './pricing.js';

const NEEDLES = ['"session_meta"', '"turn_context"', '"response_item"', '"event_msg"', '"compacted"'];
const REJECTED = /rejected by user/i;
const INTERNAL_THREADS = new Set(['guardian_review', 'memory_consolidation']);
const INTERNAL_SUBAGENTS = new Set(['compact', 'memory_consolidation']);
const ZERO = { input: 0, cached: 0, cacheWrite: 0, output: 0 };
function inc(map, key, n = 1) { map.set(key, (map.get(key) || 0) + n); }

// Mode CCTI équivalent au réglage d'un tour Codex (spec CXTI § 4.1).
export function permissionModeOf(ctx) {
  if (!ctx || ctx.approval_policy !== 'never') return 'default';
  return ctx.sandbox_policy && ctx.sandbox_policy.type === 'danger-full-access' ? 'bypassPermissions' : 'auto';
}

// Rôle d'un fichier d'après sa ligne session_meta (spec CXTI § 2.3).
export function roleOf(meta) {
  const src = meta && meta.source;
  if (src && typeof src === 'object') {
    if (src.internal) return 'internal';
    if (src.subagent !== undefined) return INTERNAL_SUBAGENTS.has(src.subagent) ? 'internal' : 'subagent';
  }
  if (INTERNAL_THREADS.has(meta && meta.thread_source)) return 'internal';
  if (meta && meta.thread_source === 'subagent') return 'subagent';
  return 'main';
}

// Texte de la commande : trois générations d'outil shell coexistent (spec CXTI § 4.2).
export function commandOf(name, args) {
  if (name === 'exec_command' && typeof args.cmd === 'string') return args.cmd;
  if (name === 'shell' && Array.isArray(args.command)) return args.command.join(' ');
  if (name === 'shell_command' && typeof args.command === 'string') return args.command;
  return '';
}

const textOf = (content, type) => (Array.isArray(content) ? content : [])
  .filter((c) => c && c.type === type && typeof c.text === 'string').map((c) => c.text).join('\n');
function parseArgs(s) { try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
function outputText(out) {
  if (typeof out === 'string') return out;
  if (Array.isArray(out)) return out.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('\n');
  if (out && typeof out === 'object' && typeof out.content === 'string') return out.content;
  return '';
}

export class CodexAnalyzer extends Analyzer {
  constructor() {
    super({ costUsd });
    this.compressedSkipped = 0;
  }

  skipFile() { this.compressedSkipped++; }

  beginFile(info = {}) {
    super.beginFile({ project: '', sessionId: info.sessionId || '', kind: 'main' });
    Object.assign(this.f, {
      metaSeen: false, internal: false, historyMode: 'legacy', fromOrdinal: 0, model: 'unknown',
      turnMode: null, lastMode: 'default', pendingModes: 0, prev: ZERO,
    });
  }

  feedLine(line) {
    if (!this.f) this.beginFile();
    const s = this.s, f = this.f;
    if (f.internal || typeof line !== 'string' || line.length < 2) return;
    if (!NEEDLES.some((n) => line.includes(n))) return;
    let o;
    try { o = JSON.parse(line); } catch { s.corruptLines++; return; }
    if (!o || typeof o !== 'object') { s.corruptLines++; return; }
    const p = o.payload && typeof o.payload === 'object' ? o.payload : {};
    if (o.type === 'session_meta') { if (!f.metaSeen) this.#meta(p); return; }
    if (typeof o.ordinal === 'number' && o.ordinal < f.fromOrdinal) return; // historique copié du parent
    const ts = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN;
    switch (o.type) {
      case 'turn_context': this.#turnContext(p); return;
      case 'response_item': this.#item(p, o.metadata, ts); return;
      case 'event_msg': this.#event(p, ts); return;
      case 'compacted': s.compactions++; return;
      default: return;
    }
  }

  #meta(p) {
    const f = this.f;
    f.metaSeen = true;
    const role = roleOf(p);
    if (role === 'internal') { f.internal = true; return; }
    f.kind = role;
    if (p.history_mode === 'paginated') f.historyMode = 'paginated';
    if (role === 'subagent' && typeof p.subagent_history_start_ordinal === 'number') f.fromOrdinal = p.subagent_history_start_ordinal;
    if (typeof p.cwd === 'string' && p.cwd) f.project = basename(p.cwd);
    if (typeof p.cli_version === 'string') this.s.versions.add(p.cli_version);
  }

  // Le turn_context d'un tour peut arriver après le message humain : les messages en attente
  // prennent le mode de ce tour-là (spec CXTI § 4.1).
  #turnContext(p) {
    const f = this.f;
    if (typeof p.model === 'string' && p.model) f.model = p.model;
    if (p.collaboration_mode && p.collaboration_mode.mode === 'plan') f.planned = true;
    const mode = permissionModeOf(p);
    f.turnMode = mode; f.lastMode = mode;
    if (f.pendingModes) { inc(this.s.permissionModes, mode, f.pendingModes); f.pendingModes = 0; }
  }

  #human(raw, ts) {
    const f = this.f;
    if (f.kind !== 'main') return;              // les prompts des sous-agents sont écrits par le modèle
    this._touch(ts);
    if (!this._human(raw, ts)) return;
    if (f.turnMode) inc(this.s.permissionModes, f.turnMode); else f.pendingModes++;
  }

  #event(p, ts) {
    const s = this.s, f = this.f;
    switch (p.type) {
      case 'task_started': f.turnMode = null; return;
      // une seule source de message humain par mode d'historique (spec CXTI § 2.4)
      case 'user_message': if (f.historyMode === 'legacy' && typeof p.message === 'string') this.#human(p.message, ts); return;
      case 'item_completed': if (f.historyMode === 'paginated' && p.item && p.item.type === 'UserMessage') this.#human(textOf(p.item.content, 'text'), ts); return;
      case 'token_count': this.#tokens(p.info, ts); return;
      case 'task_complete': if (f.kind === 'main' && typeof p.duration_ms === 'number') s.claudeWorkMs += p.duration_ms; return;
      case 'turn_aborted':
        if (f.kind !== 'main') return;          // un sous-agent s'arrête quand son parent est interrompu
        if (typeof p.duration_ms === 'number') s.claudeWorkMs += p.duration_ms;
        if (p.reason === 'interrupted') s.interruptions++;
        return;
      default: return;
    }
  }

  // tâche 7
  #tokens() {}

  // tâche 7
  #item() {}

  endFile() {
    const f = this.f;
    if (!f) return;
    if (f.internal) { this.f = null; return; }
    if (f.pendingModes) inc(this.s.permissionModes, f.lastMode, f.pendingModes);
    super.endFile();
  }

  result() {
    const r = super.result();
    r.volume.compressedSkipped = this.compressedSkipped;
    return r;
  }
}
