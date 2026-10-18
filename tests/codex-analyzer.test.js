// tests/codex-analyzer.test.js — lecture des sessions Codex (spec CXTI § 2 et § 4).
process.env.TZ = 'Europe/Paris';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { CodexAnalyzer, permissionModeOf, roleOf, commandOf } from '../codex/analyzer.js';
import { analyzeDir } from './codex-helpers.js';
import { computeProfile } from '../src/profile.js';

// Une session faite de lignes en mémoire : [type, payload, horodatage?].
function analyzeLines(lines) {
  const a = new CodexAnalyzer();
  a.beginFile({ sessionId: 's' });
  lines.forEach(([type, payload, ts = '2026-10-05T10:00:00Z'], ordinal) => a.feedLine(JSON.stringify({ timestamp: ts, ordinal, type, payload })));
  a.endFile();
  return a.result();
}

let stats;
before(() => { stats = analyzeDir('tests/fixtures-codex'); });

// Le réglage par défaut de Codex laisse modifier le projet sans demander, mais c'est le réglage
// d'origine : l'axe mesure si l'utilisateur l'a relâché (spec CXTI § 1, décision 6).
test('permissionModeOf : seul « never » compte comme autonomie', () => {
  const m = (approval_policy, type) => permissionModeOf({ approval_policy, sandbox_policy: { type } });
  assert.equal(m('on-request', 'workspace-write'), 'default');
  assert.equal(m('on-failure', 'workspace-write'), 'default');
  assert.equal(m('untrusted', 'read-only'), 'default');
  assert.equal(permissionModeOf({ approval_policy: { granular: {} }, sandbox_policy: { type: 'workspace-write' } }), 'default');
  assert.equal(m('never', 'workspace-write'), 'auto');
  assert.equal(m('never', 'danger-full-access'), 'bypassPermissions');
});

test('roleOf : principale, sous-agent, interne', () => {
  assert.equal(roleOf({ source: 'cli', thread_source: 'user' }), 'main');
  assert.equal(roleOf({ source: 'vscode' }), 'main');
  assert.equal(roleOf({ source: { subagent: { thread_spawn: { depth: 1 } } } }), 'subagent');
  assert.equal(roleOf({ source: { subagent: 'review' } }), 'subagent');
  assert.equal(roleOf({ source: 'cli', thread_source: 'subagent' }), 'subagent');
  assert.equal(roleOf({ source: { subagent: 'compact' } }), 'internal');
  assert.equal(roleOf({ source: { internal: 'guardian' } }), 'internal');
  assert.equal(roleOf({ source: 'cli', thread_source: 'guardian_review' }), 'internal');
  assert.equal(roleOf({ source: 'cli', thread_source: 'memory_consolidation' }), 'internal');
});

test('commandOf : les trois générations d\'outil shell', () => {
  assert.equal(commandOf('exec_command', { cmd: 'ls -la' }), 'ls -la');
  assert.equal(commandOf('shell', { command: ['bash', '-lc', 'git status'] }), 'bash -lc git status');
  assert.equal(commandOf('shell_command', { command: 'git status' }), 'git status');
  assert.equal(commandOf('apply_patch', { input: 'x' }), '');
});

// Un message humain = un seul comptage, quel que soit le mode d'historique ; le contexte injecté
// (environment_context, AGENTS.md) n'est jamais compté ; ni les sous-agents ni les sessions internes.
test('sessions et messages humains', () => {
  const v = stats.volume;
  assert.equal(v.sessions, 2); assert.equal(v.ghostSessions, 1); assert.equal(v.subagents, 1);
  assert.equal(v.projects, 2);
  assert.deepEqual(v.topProjects, [{ name: 'alpha', sessions: 1 }, { name: 'beta', sessions: 1 }]);
  assert.equal(v.humanMessages, 3);
  assert.equal(v.medianCleanLength, 16);
  assert.equal(v.corruptLines, 1);
  assert.deepEqual(stats.versions, { first: '0.149.2', last: '0.153.4', count: 3 });
  assert.equal(v.activeDays, 2); assert.equal(v.firstDay, '2026-10-05'); assert.equal(v.lastDay, '2026-10-07');
  assert.deepEqual(v.longestSession, { humanMessages: 2, durationMin: 30, project: 'alpha' });
});

test('moments et couple côté humain', () => {
  assert.equal(stats.moments.eveningShare, 1);
  assert.equal(stats.moments.afterMidnightShare, 1 / 3);
  const c = stats.couple;
  assert.equal(c.humanNo, 1); assert.equal(c.humanCaps, 1); assert.equal(c.humanThanks, 1); assert.equal(c.humanSwear, 0);
  assert.equal(c.rageQuits, 1);
});

// Chaque message est compté sous le réglage de son propre tour, même quand le turn_context arrive après lui.
test('modes de permission, plan mode et type', () => {
  assert.deepEqual(stats.control.permissionModes, { default: 2, bypassPermissions: 1 });
  assert.equal(stats.control.plannedSessions, 1);
  assert.equal(computeProfile(stats).code, 'CLPN');
});

test('message vide : pas un message humain', () => {
  const r = analyzeLines([
    ['session_meta', { cwd: '/x/p', source: 'cli', thread_source: 'user', history_mode: 'legacy' }],
    ['event_msg', { type: 'user_message', message: '', images: ['data:image/png;base64,AAA'] }],
    ['event_msg', { type: 'user_message', message: '```\ncode collé\n```' }],
  ]);
  assert.equal(r.volume.humanMessages, 0);
  assert.equal(r.volume.ghostSessions, 1);
});

test('fichier sans session_meta : lu comme une session principale legacy', () => {
  const r = analyzeLines([
    ['turn_context', { approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-5' }],
    ['event_msg', { type: 'user_message', message: 'Bonjour, lance les tests' }],
  ]);
  assert.equal(r.volume.sessions, 1);
  assert.equal(r.volume.humanMessages, 1);
  assert.deepEqual(r.control.permissionModes, { default: 1 });
});

test('réponses du modèle : doublons livrés et sous-agents ignorés', () => {
  const c = stats.couple;
  assert.equal(c.claudeAgreed, 1); assert.equal(c.absolutelyRight, 1); assert.equal(c.claudeApologized, 2);
  assert.ok(c.talkRatio > 0 && c.talkRatio < 1);
  assert.equal(c.patienceMedianSec, 1770); // depuis la dernière réponse du modèle, pas depuis les tokens
});

test('outils, refus, questions, interruptions, danger', () => {
  const v = stats.volume, c = stats.couple;
  assert.equal(v.toolCalls, 5);
  assert.deepEqual(v.toolsByName, { exec_command: 2, shell: 1, apply_patch: 1, request_user_input: 1 });
  assert.equal(c.toolDenials, 1); assert.equal(c.questionsAsked, 1); assert.equal(c.interruptions, 1);
  assert.deepEqual(stats.danger, { rmRf: 1, forcePush: 1, resetHard: 0, sudo: 1, gitCommits: 1 });
  assert.equal(v.claudeWorkMinutes, 3);
  assert.equal(stats.waste.compactions, 1);
});

// La facture : token_count null, répétés ou synthétiques (contexte plein) ne comptent pas ;
// l'historique copié d'un sous-agent non plus ; l'entrée en cache n'est pas payée deux fois.
test('tours et facture au centime', () => {
  const v = stats.volume, b = stats.bill;
  assert.equal(v.assistantTurns, 3); assert.equal(v.subagentTurns, 1);
  assert.deepEqual(b.byModel['gpt-5.2-codex'], { input: 1_000_000, output: 150_000, cacheRead: 2_000_000, cacheWrite: 0, cacheWrite1h: 0, turns: 2, costUsd: 4.2 });
  assert.deepEqual(b.byModel['gpt-6-astra'], { input: 60_000, output: 10_000, cacheRead: 0, cacheWrite: 40_000, cacheWrite1h: 0, turns: 1, costUsd: 1.6 });
  assert.deepEqual(b.byModel['gpt-5.1-codex-mini'], { input: 200_000, output: 10_000, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0, turns: 1, costUsd: 0.07 });
  assert.equal(b.costUsd, 5.87); assert.equal(b.unpricedTokens, 0);
  assert.deepEqual(stats.models.map((m) => m.name), ['gpt-5.2-codex', 'gpt-5.1-codex-mini', 'gpt-6-astra']);
  assert.equal(stats.waste.maxContext, 2_000_000);
});

test('changement de modèle en cours de session : chaque tour au modèle de son tour', () => {
  const u = (input, output) => ({ input_tokens: input, cached_input_tokens: 0, output_tokens: output, total_tokens: input + output });
  const r = analyzeLines([
    ['session_meta', { cwd: '/x/p', source: 'cli', thread_source: 'user' }],
    ['turn_context', { approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-5' }],
    ['event_msg', { type: 'user_message', message: 'premier tour' }],
    ['event_msg', { type: 'token_count', info: { total_token_usage: u(1000, 100), last_token_usage: u(1000, 100) } }],
    ['turn_context', { approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'o3' }],
    ['event_msg', { type: 'user_message', message: 'second tour' }],
    ['event_msg', { type: 'token_count', info: { total_token_usage: u(3000, 300), last_token_usage: u(2000, 200) } }],
  ]);
  assert.equal(r.bill.byModel['gpt-5'].input, 1000); assert.equal(r.bill.byModel['gpt-5'].output, 100);
  assert.equal(r.bill.byModel.o3.input, 2000); assert.equal(r.bill.byModel.o3.output, 200);
});

test('mesures sans équivalent Codex : null', () => {
  const c = stats.couple, w = stats.waste;
  for (const k of ['questionsAnswered', 'interruptionsForTool', 'autoModeBlocks', 'modelRefusalFallbacks']) assert.equal(c[k], null, k);
  assert.equal(stats.control.slashCommands, null);
  for (const k of ['turnsOver150k', 'turnsOver150kShare', 'costOver150kUsd', 'costOver150kShare', 'cacheRebuilds', 'cacheRebuildsShortPause', 'cacheRebuildExcessUsd']) assert.equal(w[k], null, k);
});

// Des versions de Codex ont écrit AGENTS.md et le contexte d'environnement comme user_message :
// ce n'est pas l'humain qui parle, et ces textes longs feraient passer la session pour planifiée.
test('contexte injecté en user_message : pas un message humain', () => {
  const r = analyzeLines([
    ['session_meta', { cwd: '/x/p', source: 'cli', thread_source: 'user', history_mode: 'legacy' }],
    ['event_msg', { type: 'user_message', message: '<environment_context>\n  <cwd>/x/p</cwd>\n</environment_context>', kind: 'environment_context' }],
    ['event_msg', { type: 'user_message', message: '# AGENTS.md instructions for /x/p\n\n<INSTRUCTIONS>\n' + 'Règle. '.repeat(120) + '\n</INSTRUCTIONS>' }],
    ['event_msg', { type: 'user_message', message: '<user_instructions>\nSois bref.\n</user_instructions>' }],
    ['event_msg', { type: 'user_message', message: 'lance les tests', kind: 'plain' }],
  ]);
  assert.equal(r.volume.humanMessages, 1);
  assert.equal(r.volume.medianCleanLength, 'lance les tests'.length);
  assert.equal(r.control.plannedSessions, 0);
});
