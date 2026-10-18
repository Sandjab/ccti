// tests/codex-analyzer.test.js — lecture des sessions Codex (spec CXTI § 2 et § 4).
process.env.TZ = 'Europe/Paris';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CodexAnalyzer, permissionModeOf, roleOf, commandOf } from '../codex/analyzer.js';
import { classify } from '../codex/files.js';
import { computeProfile } from '../src/profile.js';

export function analyzeDir(dir) {
  const rels = readdirSync(dir, { recursive: true }).map((f) => f.split(path.sep).join('/')).sort();
  const a = new CodexAnalyzer();
  for (const it of classify(rels.map((rel) => ({ file: path.join(dir, rel), rel })))) {
    if (it.skip) { a.skipFile(it); continue; }
    a.beginFile({ sessionId: it.sessionId });
    for (const line of readFileSync(it.file, 'utf8').split('\n')) a.feedLine(line);
    a.endFile();
  }
  return a.result();
}
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
  assert.equal(v.compressedSkipped, 1);
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
