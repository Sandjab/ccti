// src/demo.js — stats synthétiques pour « Voir un exemple ». Aucune donnée réelle. Type attendu : AVPN.
export default {
  meta: { generatedAt: '2026-10-17T00:00:00.000Z', cctiVersion: '0.1.0', tz: 'Europe/Paris', lowConfidence: false },
  volume: {
    sessions: 420, ghostSessions: 61, projects: 23,
    topProjects: [{ name: 'atelier', sessions: 74 }, { name: 'cartes', sessions: 58 }, { name: 'vigie', sessions: 41 }, { name: 'sextant', sessions: 33 }, { name: 'herbier', sessions: 27 }],
    humanMessages: 1300, assistantTurns: 9800, toolCalls: 15400,
    toolsByName: { Bash: 5200, Read: 3100, Edit: 2900, Write: 900, Grep: 800, Agent: 420, TodoWrite: 380, WebSearch: 210, AskUserQuestion: 140, Glob: 130, other: 1320 },
    subagents: 310, subagentTurns: 2600, activeDays: 141, firstDay: '2026-05-11', lastDay: '2026-10-02', longestStreakDays: 23,
    longestSession: { humanMessages: 61, durationMin: 412, project: 'atelier' }, claudeWorkMinutes: 9120, corruptLines: 3, medianCleanLength: 260,
  },
  moments: {
    byHour: [40, 28, 16, 8, 4, 2, 3, 10, 35, 70, 85, 75, 40, 55, 80, 85, 75, 60, 40, 30, 24, 120, 170, 145],
    byWeekday: [150, 230, 210, 190, 180, 160, 180],
    eveningShare: 0.41, afterMidnightShare: 0.075, allNighters: 4, latestHour: { hour: 4, minute: 12 },
  },
  couple: {
    claudeAgreed: 212, absolutelyRight: 37, claudeApologized: 64, humanNo: 48, humanCaps: 3, humanSwear: 6, humanThanks: 91, humanDoubleMarks: 11,
    interruptions: 25, interruptionsForTool: 9, toolDenials: 8, autoModeBlocks: 4, questionsAsked: 140, questionsAnswered: 97, rageQuits: 5,
    talkRatio: 0.09, patienceMedianSec: 34, modelRefusalFallbacks: 2,
  },
  danger: { rmRf: 7, forcePush: 2, resetHard: 4, sudo: 12, gitCommits: 1180 },
  control: { permissionModes: { auto: 900, default: 260, acceptEdits: 110, plan: 30 }, plannedSessions: 180, slashCommands: { '/clear': 80, '/model': 22, '/context': 15, '/commit': 12 } },
  bill: {
    byModel: {
      'claude-opus-4-7': { input: 41000000, output: 5200000, cacheRead: 820000000, cacheWrite: 61000000, turns: 6900, costUsd: 1126.25 },
      'claude-opus-4-8': { input: 9000000, output: 1300000, cacheRead: 210000000, cacheWrite: 14000000, turns: 2100, costUsd: 270 },
      'claude-fable-5': { input: 2000000, output: 400000, cacheRead: 90000000, cacheWrite: 7000000, turns: 1400, costUsd: 217.5 },
      'claude-sonnet-4-6': { input: 3000000, output: 300000, cacheRead: 40000000, cacheWrite: 3000000, turns: 1500, costUsd: 36.75 },
      'claude-haiku-4-5': { input: 1500000, output: 150000, cacheRead: 12000000, cacheWrite: 900000, turns: 500, costUsd: 4.58 },
    },
    costUsd: 1655.08, unpricedTokens: 0,
  },
  waste: {
    turnsOver150k: 2480, turnsOver150kShare: 0.2, costOver150kUsd: 870.4, costOver150kShare: 0.526,
    maxContext: 412000, compactions: 6, cacheRebuilds: 140, cacheRebuildsShortPause: 61, cacheRebuildExcessUsd: 96.3,
  },
  models: [
    { name: 'claude-opus-4-7', turns: 6900, share: 0.556 }, { name: 'claude-opus-4-8', turns: 2100, share: 0.169 },
    { name: 'claude-sonnet-4-6', turns: 1500, share: 0.121 }, { name: 'claude-fable-5', turns: 1400, share: 0.113 }, { name: 'claude-haiku-4-5', turns: 500, share: 0.04 },
  ],
  versions: { first: '2.1.98', last: '2.1.204', count: 31 },
};
