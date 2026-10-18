// src/analyzer.js — cœur de CCTI. JavaScript pur, aucune dépendance, aucun DOM.
// Consomme des lignes JSONL de Claude Code et ne conserve que des agrégats (spec § 3-4).
import {
  cleanText, INTERRUPTED, INTERRUPTED_FOR_TOOL, SLASH_COMMAND,
  CLAUDE_AGREED, ABSOLUTELY_RIGHT, CLAUDE_APOLOGIZED,
  HUMAN_NO, HUMAN_SWEAR, HUMAN_THANKS, HUMAN_DOUBLE_MARKS,
  TOOL_DENIED, AUTO_MODE_BLOCK, DANGER, matchesAny, isCaps,
} from './patterns.js';
import { costUsd, priceFor } from './pricing.js';

export const CCTI_VERSION = '0.1.0';
const NEEDLES = ['"type":"user"', '"type":"assistant"', '"type":"permission-mode"', '"type":"system"'];
const KNOWN_MODES = new Set(['default', 'acceptEdits', 'auto', 'bypassPermissions', 'plan', 'dontAsk']);
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function basename(p) {
  const parts = String(p ?? '').split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
export function projectFromSlug(slug) {
  const s = String(slug ?? '');
  const i = s.lastIndexOf('-');
  return i >= 0 ? s.slice(i + 1) : s;
}
function inc(map, key, n = 1) { map.set(key, (map.get(key) || 0) + n); }
function pad(n) { return String(n).padStart(2, '0'); }
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function round2(x) { return Math.round(x * 100) / 100; }
function compareVersions(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n');
  return '';
}
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export class Analyzer {
  constructor(opts = {}) {
    // grille de prix : celle d'Anthropic par défaut ; Codex passe celle d'OpenAI (spec CXTI § 4.4)
    this.costUsd = opts.costUsd || costUsd;
    this.s = {
      sessions: 0, ghostSessions: 0, projects: new Map(), humanMessages: 0, assistantTurns: 0,
      toolCalls: 0, toolsByName: new Map(), subagents: 0, subagentTurns: 0, days: new Map(),
      byHour: new Array(24).fill(0), byWeekday: new Array(7).fill(0), evening: 0, afterMidnight: 0,
      nightByDay: new Map(), latest: null, claudeWorkMs: 0, corruptLines: 0, cleanLengths: [],
      humanChars: 0, assistantChars: 0, patience: [], longestSession: null,
      claudeAgreed: 0, absolutelyRight: 0, claudeApologized: 0, humanNo: 0, humanCaps: 0, humanSwear: 0,
      humanThanks: 0, humanDoubleMarks: 0, interruptions: 0, interruptionsForTool: 0, toolDenials: 0,
      autoModeBlocks: 0, questionsAsked: 0, questionsAnswered: 0, rageQuits: 0, modelRefusalFallbacks: 0,
      rmRf: 0, forcePush: 0, resetHard: 0, sudo: 0, gitCommits: 0,
      permissionModes: new Map(), plannedSessions: 0, slashCommands: new Map(),
      byModel: new Map(), versions: new Set(),
      // gaspillage (spec § 4.7)
      turnsOver150k: 0, costOver150k: 0, maxContext: 0, compactions: 0,
      cacheRebuilds: 0, cacheRebuildsShortPause: 0, cacheRebuildExcess: 0,
    };
    this.f = null;
  }

  beginFile({ project = '', kind = 'main', sessionId = '' } = {}) {
    this.f = {
      kind, project, sessionId, humanMessages: 0, firstTs: NaN, lastTs: NaN, lastAssistantTs: NaN, prevTurnTs: NaN,
      lastHumanNegative: false, permissionMode: 'default', planned: false, firstHumanLen: -1,
      seenMsgIds: new Map(), askIds: new Set(), cwdSeen: false,
    };
  }

  feedLine(line) {
    if (!this.f) this.beginFile();
    const s = this.s, f = this.f;
    if (typeof line !== 'string' || line.length < 2) return;
    if (!NEEDLES.some((n) => line.includes(n))) return;
    let o;
    try { o = JSON.parse(line); } catch { s.corruptLines++; return; }
    if (!o || typeof o !== 'object') { s.corruptLines++; return; }
    if (typeof o.version === 'string') s.versions.add(o.version);
    if (!f.cwdSeen && typeof o.cwd === 'string' && o.cwd) {
      f.cwdSeen = true;
      const b = basename(o.cwd);
      if (b) f.project = b;
    }
    const ts = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN;
    switch (o.type) {
      case 'permission-mode': {
        const m = typeof o.permissionMode === 'string' ? o.permissionMode : 'default';
        f.permissionMode = KNOWN_MODES.has(m) ? m : 'other';
        if (m === 'plan') f.planned = true;
        return;
      }
      case 'system':
        if (o.subtype === 'turn_duration' && typeof o.durationMs === 'number') s.claudeWorkMs += o.durationMs;
        else if (o.subtype === 'model_refusal_fallback') s.modelRefusalFallbacks++;
        else if (o.subtype === 'compact_boundary') s.compactions++;
        return;
      case 'user': this.#user(o, ts); return;
      case 'assistant': this.#assistant(o, ts); return;
      default: return;
    }
  }

  _touch(ts) {
    const f = this.f;
    if (Number.isNaN(ts)) return;
    // min / max : les lignes d'une session reprise ne sont pas toujours dans l'ordre chronologique
    if (Number.isNaN(f.firstTs) || ts < f.firstTs) f.firstTs = ts;
    if (Number.isNaN(f.lastTs) || ts > f.lastTs) f.lastTs = ts;
  }

  #user(o, ts) {
    const s = this.s, f = this.f, m = o.message;
    if (!m || typeof m !== 'object') return;
    const c = m.content;
    const blocks = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : null;
    if (!blocks) return;
    this._touch(ts);
    const results = blocks.filter((b) => b && b.type === 'tool_result');
    if (results.length) {
      for (const r of results) {
        const t = textOf(r.content);
        const denied = TOOL_DENIED.test(t);
        if (denied) s.toolDenials++;
        if (AUTO_MODE_BLOCK.test(t)) s.autoModeBlocks++;
        if (INTERRUPTED.test(t)) { s.interruptions++; if (INTERRUPTED_FOR_TOOL.test(t)) s.interruptionsForTool++; }
        if (f.askIds.has(r.tool_use_id) && !denied) s.questionsAnswered++;
      }
      return;
    }
    if (f.kind !== 'main') return;              // les prompts des sous-agents sont écrits par Claude
    if (o.isMeta || o.isCompactSummary) return;
    const raw = blocks.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
    const slash = SLASH_COMMAND.exec(raw);
    if (slash) { inc(s.slashCommands, slash[1].trim()); return; }
    if (INTERRUPTED.test(raw)) { s.interruptions++; if (INTERRUPTED_FOR_TOOL.test(raw)) s.interruptionsForTool++; return; }
    if (this._human(raw, ts)) inc(s.permissionModes, f.permissionMode);
  }

  // Message humain reconnu comme tel par le lecteur de format : comptages communs à Claude Code
  // et Codex. Renvoie false si le texte nettoyé est vide (rien n'est compté).
  _human(raw, ts) {
    const s = this.s, f = this.f;
    const clean = cleanText(raw);
    if (!clean) return false;
    s.humanMessages++; f.humanMessages++;
    s.cleanLengths.push(clean.length); s.humanChars += clean.length;
    if (f.firstHumanLen < 0) f.firstHumanLen = clean.length;
    if (!Number.isNaN(ts)) {
      const d = new Date(ts), h = d.getHours(), day = dayKey(d);
      s.byHour[h]++; s.byWeekday[d.getDay()]++; inc(s.days, day);
      if (h >= 21 || h < 6) s.evening++;
      if (h < 6) s.afterMidnight++;
      if (h >= 2 && h < 6) inc(s.nightByDay, day);
      const night = h < 6, minutes = h * 60 + d.getMinutes();
      if (!s.latest || (night && !s.latest.night) || (night === s.latest.night && minutes > s.latest.minutes)) s.latest = { night, minutes };
      if (!Number.isNaN(f.lastAssistantTs) && ts > f.lastAssistantTs && ts - f.lastAssistantTs < HOUR_MS) s.patience.push((ts - f.lastAssistantTs) / 1000);
    }
    const no = matchesAny(HUMAN_NO, clean), caps = isCaps(clean), swear = matchesAny(HUMAN_SWEAR, clean);
    if (no) s.humanNo++;
    if (caps) s.humanCaps++;
    if (swear) s.humanSwear++;
    if (matchesAny(HUMAN_THANKS, clean)) s.humanThanks++;
    if (matchesAny(HUMAN_DOUBLE_MARKS, clean)) s.humanDoubleMarks++;
    f.lastHumanNegative = no || caps || swear;
    return true;
  }

  // Texte d'une réponse du modèle (sessions principales seulement).
  _assistantText(text) {
    const s = this.s;
    if (this.f.kind !== 'main') return;
    s.assistantChars += text.length;
    if (matchesAny(CLAUDE_AGREED, text)) s.claudeAgreed++;
    if (ABSOLUTELY_RIGHT.test(text)) s.absolutelyRight++;
    if (matchesAny(CLAUDE_APOLOGIZED, text)) s.claudeApologized++;
  }

  _tool(name) { this.s.toolCalls++; inc(this.s.toolsByName, name); }

  _command(cmd) { for (const k of Object.keys(DANGER)) if (DANGER[k].test(cmd)) this.s[k]++; }

  #assistant(o, ts) {
    const s = this.s, f = this.f, m = o.message;
    if (!m || typeof m !== 'object') return;
    if (m.model === '<synthetic>') return; // écrit par Claude Code (erreur d'API, coupure), pas par un modèle
    this._touch(ts);
    if (!Number.isNaN(ts)) f.lastAssistantTs = ts;
    const model = typeof m.model === 'string' && m.model ? m.model : 'unknown';
    const key = typeof m.id === 'string' ? `${m.id}:${o.requestId || ''}` : null;
    // Un tour peut s'étaler sur plusieurs lignes (même message.id + requestId) ; l'usage y croît
    // pendant le flux (output_tokens surtout). On compte le tour une fois et on garde, champ par
    // champ, la plus grande valeur vue : le total final du tour.
    const u = m.usage && typeof m.usage === 'object' ? m.usage : {};
    const cc = u.cache_creation && typeof u.cache_creation === 'object' ? u.cache_creation : {};
    const usage = {
      input: u.input_tokens || 0, output: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0,
      cacheWrite1h: cc.ephemeral_1h_input_tokens || 0,
    };
    let seen = key ? f.seenMsgIds.get(key) : null;
    let bm;
    if (!seen) {
      if (f.kind === 'main') s.assistantTurns++; else s.subagentTurns++;
      bm = s.byModel.get(model);
      if (!bm) { bm = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0, turns: 0 }; s.byModel.set(model, bm); }
      bm.turns++;
      // gap : temps écoulé depuis le tour précédent du même fichier (cache 5 min expiré au-delà de 300 s)
      const gapSec = !Number.isNaN(ts) && !Number.isNaN(f.prevTurnTs) ? (ts - f.prevTurnTs) / 1000 : NaN;
      if (!Number.isNaN(ts)) f.prevTurnTs = ts;
      seen = { bm, model, gapSec, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0, cost: 0, big: false, rebuilt: false };
      if (key) f.seenMsgIds.set(key, seen);
    }
    let grew = false;
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite1h']) {
      if (usage[k] > seen[k]) { seen.bm[k] += usage[k] - seen[k]; seen[k] = usage[k]; grew = true; }
    }
    if (grew) this.#waste(seen);
    if (!Array.isArray(m.content)) return;
    for (const b of m.content) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'text' && typeof b.text === 'string') this._assistantText(b.text);
      else if (b.type === 'tool_use') {
        const name = typeof b.name === 'string' ? b.name : 'unknown';
        this._tool(name);
        if (name === 'AskUserQuestion') { if (f.kind === 'main') s.questionsAsked++; f.askIds.add(b.id); }
        else if (name === 'EnterPlanMode' || name === 'ExitPlanMode') f.planned = true;
        else if (name === 'Bash' && b.input && typeof b.input.command === 'string') this._command(b.input.command);
      }
    }
  }

  // Gaspillage d'un tour, recalculé à chaque fois que son usage croît (tour en flux).
  #waste(t) {
    const s = this.s;
    const ctx = t.input + t.cacheRead + t.cacheWrite;
    if (ctx > s.maxContext) s.maxContext = ctx;
    const p = priceFor(t.model);
    if (ctx >= 150000) {
      if (!t.big) { t.big = true; s.turnsOver150k++; }
      if (p) { const c = costUsd(t, t.model); s.costOver150k += c - t.cost; t.cost = c; }
    }
    // Reconstruction : après une pause de plus de 5 min, au moins 10 k tokens réécrits en cache
    // et moins relus qu'écrits. Surcoût = écriture payée au lieu d'une lecture.
    if (!t.rebuilt && t.gapSec > 300 && t.cacheWrite >= 10000 && t.cacheRead < t.cacheWrite) {
      t.rebuilt = true;
      s.cacheRebuilds++;
      if (t.gapSec <= 900) s.cacheRebuildsShortPause++;
      if (p) {
        const w1h = Math.min(t.cacheWrite1h, t.cacheWrite);
        s.cacheRebuildExcess += ((t.cacheWrite - w1h) * (p.cacheWrite - p.cacheRead) + w1h * (2 * p.input - p.cacheRead)) / 1e6;
      }
    }
  }

  endFile() {
    const s = this.s, f = this.f;
    if (!f) return;
    if (f.kind === 'main') {
      if (f.humanMessages > 0) {
        s.sessions++;
        inc(s.projects, f.project || '?');
        if (f.lastHumanNegative) s.rageQuits++;
        if (f.planned || f.firstHumanLen >= 600) s.plannedSessions++;
        const durationMin = !Number.isNaN(f.firstTs) && !Number.isNaN(f.lastTs) ? Math.round((f.lastTs - f.firstTs) / 60000) : 0;
        if (!s.longestSession || f.humanMessages > s.longestSession.humanMessages) {
          s.longestSession = { humanMessages: f.humanMessages, durationMin, project: f.project || '?' };
        }
      } else s.ghostSessions++;
    } else s.subagents++;
    this.f = null;
  }

  result() {
    const s = this.s;
    const days = [...s.days.keys()].sort();
    let streak = 0, best = 0, prev = null;
    for (const d of days) {
      const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
      streak = prev !== null && t - prev === DAY_MS ? streak + 1 : 1;
      best = Math.max(best, streak);
      prev = t;
    }
    const tools = top(s.toolsByName, 15);
    const toolsByName = Object.fromEntries(tools);
    const otherTools = [...s.toolsByName.values()].reduce((a, b) => a + b, 0) - tools.reduce((a, [, v]) => a + v, 0);
    if (otherTools > 0) toolsByName.other = otherTools;
    const byModel = {};
    let costTotal = 0, unpriced = 0;
    for (const [name, u] of s.byModel) {
      const c = this.costUsd(u, name);
      if (c === null) unpriced += u.input + u.output + u.cacheRead + u.cacheWrite; else costTotal += c; // cacheWrite inclut cacheWrite1h
      byModel[name] = { ...u, costUsd: c === null ? 0 : round2(c) };
    }
    const turnsTotal = [...s.byModel.values()].reduce((a, u) => a + u.turns, 0) || 1;
    const models = [...s.byModel.entries()].map(([name, u]) => ({ name, turns: u.turns, share: u.turns / turnsTotal })).sort((a, b) => b.turns - a.turns);
    const versions = [...s.versions].sort(compareVersions);
    let tz = 'local';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch {}
    return {
      meta: { generatedAt: new Date().toISOString(), cctiVersion: CCTI_VERSION, tz, lowConfidence: s.humanMessages < 20 },
      volume: {
        sessions: s.sessions, ghostSessions: s.ghostSessions, projects: s.projects.size,
        topProjects: top(s.projects, 10).map(([name, sessions]) => ({ name, sessions })),
        humanMessages: s.humanMessages, assistantTurns: s.assistantTurns, toolCalls: s.toolCalls, toolsByName,
        subagents: s.subagents, subagentTurns: s.subagentTurns, activeDays: days.length,
        firstDay: days[0] || null, lastDay: days[days.length - 1] || null, longestStreakDays: best,
        longestSession: s.longestSession || { humanMessages: 0, durationMin: 0, project: '' },
        claudeWorkMinutes: Math.round(s.claudeWorkMs / 60000), corruptLines: s.corruptLines,
        medianCleanLength: median(s.cleanLengths),
      },
      moments: {
        byHour: s.byHour, byWeekday: s.byWeekday,
        eveningShare: s.humanMessages ? s.evening / s.humanMessages : 0,
        afterMidnightShare: s.humanMessages ? s.afterMidnight / s.humanMessages : 0,
        allNighters: [...s.nightByDay.values()].filter((n) => n >= 3).length,
        latestHour: s.latest ? { hour: Math.floor(s.latest.minutes / 60), minute: s.latest.minutes % 60 } : null,
      },
      couple: {
        claudeAgreed: s.claudeAgreed, absolutelyRight: s.absolutelyRight, claudeApologized: s.claudeApologized,
        humanNo: s.humanNo, humanCaps: s.humanCaps, humanSwear: s.humanSwear, humanThanks: s.humanThanks,
        humanDoubleMarks: s.humanDoubleMarks, interruptions: s.interruptions, interruptionsForTool: s.interruptionsForTool,
        toolDenials: s.toolDenials, autoModeBlocks: s.autoModeBlocks, questionsAsked: s.questionsAsked,
        questionsAnswered: s.questionsAnswered, rageQuits: s.rageQuits,
        talkRatio: s.humanChars + s.assistantChars ? s.humanChars / (s.humanChars + s.assistantChars) : 0,
        patienceMedianSec: Math.round(median(s.patience)), modelRefusalFallbacks: s.modelRefusalFallbacks,
      },
      danger: { rmRf: s.rmRf, forcePush: s.forcePush, resetHard: s.resetHard, sudo: s.sudo, gitCommits: s.gitCommits },
      control: { permissionModes: Object.fromEntries(s.permissionModes), plannedSessions: s.plannedSessions, slashCommands: Object.fromEntries(top(s.slashCommands, 10)) },
      bill: { byModel, costUsd: round2(costTotal), unpricedTokens: unpriced },
      waste: {
        turnsOver150k: s.turnsOver150k,
        turnsOver150kShare: (s.assistantTurns + s.subagentTurns) ? s.turnsOver150k / (s.assistantTurns + s.subagentTurns) : 0,
        costOver150kUsd: round2(s.costOver150k),
        costOver150kShare: costTotal ? s.costOver150k / costTotal : 0,
        maxContext: s.maxContext, compactions: s.compactions,
        cacheRebuilds: s.cacheRebuilds, cacheRebuildsShortPause: s.cacheRebuildsShortPause,
        cacheRebuildExcessUsd: round2(s.cacheRebuildExcess),
      },
      models,
      versions: { first: versions[0] || null, last: versions[versions.length - 1] || null, count: versions.length },
    };
  }
}
