// codex/demo.js — stats synthétiques pour l'onglet Codex de « Voir un exemple ». Aucune donnée réelle. Type attendu : ALID.
export default {
  meta: { generatedAt: '2026-10-18T00:00:00.000Z', cctiVersion: '0.1.0', tz: 'Europe/Paris', lowConfidence: false },
  volume: {
    sessions: 300, ghostSessions: 44, projects: 17,
    topProjects: [{ name: 'atelier', sessions: 61 }, { name: 'cartes', sessions: 44 }, { name: 'vigie', sessions: 30 }, { name: 'sextant', sessions: 22 }, { name: 'herbier', sessions: 19 }],
    humanMessages: 900, assistantTurns: 7000, toolCalls: 11000,
    toolsByName: { exec_command: 6100, apply_patch: 2700, update_plan: 900, web_search: 400, request_user_input: 60, view_image: 40, other: 800 },
    subagents: 120, subagentTurns: 1200, activeDays: 96, firstDay: '2026-06-02', lastDay: '2026-10-09', longestStreakDays: 11,
    longestSession: { humanMessages: 38, durationMin: 205, project: 'atelier' }, claudeWorkMinutes: 5400, corruptLines: 0, medianCleanLength: 120,
  },
  moments: {
    byHour: [14, 9, 6, 4, 2, 1, 5, 12, 30, 62, 70, 66, 40, 48, 66, 72, 70, 60, 45, 30, 26, 70, 52, 40],
    byWeekday: [60, 170, 160, 150, 150, 140, 70],
    eveningShare: 0.22, afterMidnightShare: 0.04, allNighters: 1, latestHour: { hour: 5, minute: 3 },
  },
  couple: {
    claudeAgreed: 60, absolutelyRight: 0, claudeApologized: 41, humanNo: 70, humanCaps: 9, humanSwear: 4, humanThanks: 25, humanDoubleMarks: 14,
    interruptions: 40, interruptionsForTool: null, toolDenials: 6, autoModeBlocks: null, questionsAsked: 60, questionsAnswered: null, rageQuits: 6,
    talkRatio: 0.07, patienceMedianSec: 41, modelRefusalFallbacks: null,
  },
  danger: { rmRf: 3, forcePush: 1, resetHard: 2, sudo: 5, gitCommits: 640 },
  control: { permissionModes: { default: 380, auto: 320, bypassPermissions: 200 }, plannedSessions: 30, slashCommands: null },
  bill: {
    byModel: {
      'gpt-6-astra': { input: 10000000, output: 1500000, cacheRead: 200000000, cacheWrite: 8000000, cacheWrite1h: 0, turns: 2200, costUsd: 475 },
      'gpt-5.2-codex': { input: 60000000, output: 4000000, cacheRead: 900000000, cacheWrite: 0, cacheWrite1h: 0, turns: 5000, costUsd: 318.5 },
      'gpt-5.1-codex-mini': { input: 5000000, output: 500000, cacheRead: 40000000, cacheWrite: 0, cacheWrite1h: 0, turns: 1000, costUsd: 3.25 },
    },
    costUsd: 796.75, unpricedTokens: 0,
  },
  waste: {
    turnsOver150k: null, turnsOver150kShare: null, costOver150kUsd: null, costOver150kShare: null,
    maxContext: 241000, compactions: 22, cacheRebuilds: null, cacheRebuildsShortPause: null, cacheRebuildExcessUsd: null,
  },
  models: [
    { name: 'gpt-5.2-codex', turns: 5000, share: 0.61 }, { name: 'gpt-6-astra', turns: 2200, share: 0.268 }, { name: 'gpt-5.1-codex-mini', turns: 1000, share: 0.122 },
  ],
  versions: { first: '0.131.0', last: '0.153.4', count: 19 },
};
