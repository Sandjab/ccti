// src/profile.js — 4 axes, 16 types, observations à seuils (spec § 5). Fonctions pures.
export const THRESHOLDS = { A: 50, V: 50, P: 33, N: 35 };
const r = (x) => Math.round(x);

export function computeAxes(stats) {
  const pm = stats.control.permissionModes || {};
  const hm = stats.volume.humanMessages || 0;
  const autoCount = (pm.auto || 0) + (pm.bypassPermissions || 0) + (pm.acceptEdits || 0) + (pm.dontAsk || 0);
  const autoShare = hm ? autoCount / hm : 0;
  const friction = hm ? (stats.couple.interruptions + stats.couple.toolDenials) / hm : 0;
  const A = 70 * autoShare + 30 * (1 - Math.min(1, 10 * friction));
  const V = Math.min(100, (stats.volume.medianCleanLength || 0) / 4);
  const P = stats.volume.sessions ? (100 * stats.control.plannedSessions) / stats.volume.sessions : 0;
  const N = 100 * (stats.moments.eveningShare || 0);
  return { A: r(A), V: r(V), P: r(P), N: r(N) };
}

export function typeCode(axes) {
  return (axes.A >= THRESHOLDS.A ? 'A' : 'C') + (axes.V >= THRESHOLDS.V ? 'V' : 'L')
    + (axes.P >= THRESHOLDS.P ? 'P' : 'I') + (axes.N >= THRESHOLDS.N ? 'N' : 'D');
}

// Ordre = priorité d'affichage (spec § 5.2). n() renvoie la valeur brute ; fmt dit comment la formater.
export const OBSERVATIONS = [
  { id: 'night', fmt: 'pct', when: (s) => s.moments.eveningShare >= 0.35, n: (s) => s.moments.eveningShare },
  { id: 'midnight', fmt: 'pct', when: (s) => s.moments.afterMidnightShare >= 0.15, n: (s) => s.moments.afterMidnightShare },
  { id: 'allnighters', fmt: 'int', when: (s) => s.moments.allNighters >= 2, n: (s) => s.moments.allNighters },
  { id: 'agreed', fmt: 'int', when: (s) => s.couple.claudeAgreed >= 10 && s.volume.assistantTurns > 0 && s.couple.claudeAgreed / s.volume.assistantTurns >= 0.02, n: (s) => s.couple.claudeAgreed },
  { id: 'absolutely', fmt: 'int', when: (s) => s.couple.absolutelyRight >= 5, n: (s) => s.couple.absolutelyRight },
  { id: 'apologies', fmt: 'int', when: (s) => s.couple.claudeApologized >= 10, n: (s) => s.couple.claudeApologized },
  { id: 'no_gt_thanks', fmt: 'int', when: (s) => s.couple.humanNo > s.couple.humanThanks, n: (s) => s.couple.humanNo },
  { id: 'thanks', fmt: 'int', when: (s) => s.couple.humanThanks >= 10 && s.couple.humanThanks >= 3 * Math.max(1, s.couple.humanNo), n: (s) => s.couple.humanThanks },
  { id: 'caps', fmt: 'int', when: (s) => s.couple.humanCaps >= 1, n: (s) => s.couple.humanCaps },
  { id: 'swear', fmt: 'int', when: (s) => s.couple.humanSwear >= 1, n: (s) => s.couple.humanSwear },
  { id: 'ragequit', fmt: 'int', when: (s) => s.couple.rageQuits >= 2, n: (s) => s.couple.rageQuits },
  { id: 'interruptions', fmt: 'int', when: (s) => s.couple.interruptions >= 10, n: (s) => s.couple.interruptions },
  { id: 'denials', fmt: 'int', when: (s) => s.couple.toolDenials >= 5, n: (s) => s.couple.toolDenials },
  { id: 'rmrf', fmt: 'int', when: (s) => s.danger.rmRf >= 1, n: (s) => s.danger.rmRf },
  { id: 'forcepush', fmt: 'int', when: (s) => s.danger.forcePush >= 1, n: (s) => s.danger.forcePush },
  { id: 'cost', fmt: 'usd', when: (s) => s.bill.costUsd >= 500, n: (s) => s.bill.costUsd },
  { id: 'streak', fmt: 'int', when: (s) => s.volume.longestStreakDays >= 14, n: (s) => s.volume.longestStreakDays },
  { id: 'projects', fmt: 'int', when: (s) => s.volume.projects >= 30, n: (s) => s.volume.projects },
  { id: 'subagents', fmt: 'int', when: (s) => s.volume.subagents >= 100, n: (s) => s.volume.subagents },
  { id: 'questions', fmt: 'int', when: (s) => s.couple.questionsAsked >= 10 && s.couple.questionsAnswered < 0.7 * s.couple.questionsAsked, n: (s) => s.couple.questionsAsked },
  { id: 'models', fmt: 'int', when: (s) => s.models.length >= 4, n: (s) => s.models.length },
  { id: 'noplan', fmt: 'int', when: (s) => s.volume.sessions >= 20 && s.control.plannedSessions / s.volume.sessions < 0.05, n: (s) => s.control.plannedSessions },
  { id: 'patience', fmt: 'sec', when: (s) => s.couple.patienceMedianSec > 0 && s.couple.patienceMedianSec <= 20, n: (s) => s.couple.patienceMedianSec },
  { id: 'work', fmt: 'hours', when: (s) => s.volume.claudeWorkMinutes >= 6000, n: (s) => s.volume.claudeWorkMinutes / 60 },
];

export function computeProfile(stats, limit = 5) {
  const axes = computeAxes(stats);
  const observations = OBSERVATIONS.filter((o) => o.when(stats)).slice(0, limit)
    .map((o) => ({ id: o.id, fmt: o.fmt, n: o.n(stats) }));
  return { axes, code: typeCode(axes), observations, lowConfidence: !!(stats.meta && stats.meta.lowConfidence) };
}
