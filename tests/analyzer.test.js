// tests/analyzer.test.js
process.env.TZ = 'Europe/Paris';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Analyzer, basename, projectFromSlug } from '../src/analyzer.js';
import { analyzeDirectory, listSessionFiles, resolveRoot } from '../scripts/lib/walk.mjs';

let stats;
before(async () => { ({ stats } = await analyzeDirectory('tests/fixtures/projects')); });

test('helpers de chemin', () => {
  assert.equal(basename('/Users/test/Dev/alpha'), 'alpha');
  assert.equal(basename('C:\\Users\\x\\Dev\\beta\\'), 'beta');
  assert.equal(projectFromSlug('-Users-test-Dev-alpha'), 'alpha');
});

test('resolveRoot accepte le parent de projects/', async () => {
  assert.equal(await resolveRoot('tests/fixtures'), await resolveRoot('tests/fixtures/projects'));
});

test('listSessionFiles distingue sessions et sous-agents', async () => {
  const files = await listSessionFiles(await resolveRoot('tests/fixtures/projects'));
  assert.equal(files.filter((f) => f.kind === 'main').length, 8);
  assert.equal(files.filter((f) => f.kind === 'subagent').length, 2);
  assert.ok(files.every((f) => f.path.endsWith('.jsonl')));
  const sub = files.find((f) => f.kind === 'subagent');
  assert.equal(sub.sessionId, 'a4444444-0000-0000-0000-000000000004');
});

test('volume', () => {
  const v = stats.volume;
  assert.equal(v.sessions, 7); assert.equal(v.ghostSessions, 1); assert.equal(v.projects, 2);
  assert.deepEqual(v.topProjects, [{ name: 'beta', sessions: 4 }, { name: 'alpha', sessions: 3 }]);
  assert.equal(v.humanMessages, 20); assert.equal(v.assistantTurns, 15);
  assert.equal(v.subagents, 2); assert.equal(v.subagentTurns, 3);
  assert.equal(v.toolCalls, 9); assert.equal(v.toolsByName.Bash, 4); assert.equal(v.toolsByName.AskUserQuestion, 2);
  assert.equal(v.activeDays, 7); assert.equal(v.firstDay, '2026-10-05'); assert.equal(v.lastDay, '2026-10-12');
  assert.equal(v.longestStreakDays, 6);
  assert.deepEqual(v.longestSession, { humanMessages: 4, durationMin: 183, project: 'beta' });
  assert.equal(v.claudeWorkMinutes, 3); assert.equal(v.corruptLines, 1); assert.equal(v.medianCleanLength, 14);
});

test('moments (heure de Paris)', () => {
  const m = stats.moments;
  assert.equal(m.byHour[9], 3); assert.equal(m.byHour[10], 3); assert.equal(m.byHour[11], 2); assert.equal(m.byHour[12], 3);
  assert.equal(m.byHour[14], 3); assert.equal(m.byHour[17], 2); assert.equal(m.byHour[23], 1); assert.equal(m.byHour[2], 3);
  assert.equal(m.byHour.reduce((a, b) => a + b, 0), 20);
  assert.deepEqual(m.byWeekday, [3, 8, 0, 3, 2, 1, 3]);
  assert.ok(Math.abs(m.eveningShare - 0.2) < 1e-9); assert.ok(Math.abs(m.afterMidnightShare - 0.15) < 1e-9);
  assert.equal(m.allNighters, 1); assert.deepEqual(m.latestHour, { hour: 2, minute: 32 });
});

test('couple', () => {
  const c = stats.couple;
  assert.equal(c.claudeAgreed, 4); assert.equal(c.absolutelyRight, 1); assert.equal(c.claudeApologized, 3);
  assert.equal(c.humanNo, 2); assert.equal(c.humanCaps, 1); assert.equal(c.humanSwear, 1); assert.equal(c.humanThanks, 4);
  assert.equal(c.humanDoubleMarks, 1); assert.equal(c.interruptions, 1); assert.equal(c.interruptionsForTool, 1);
  assert.equal(c.toolDenials, 1); assert.equal(c.autoModeBlocks, 1);
  assert.equal(c.questionsAsked, 2); assert.equal(c.questionsAnswered, 1); assert.equal(c.rageQuits, 2);
  assert.equal(c.patienceMedianSec, 40); assert.ok(c.talkRatio > 0.8 && c.talkRatio < 0.85);
  assert.equal(c.modelRefusalFallbacks, 1);
});

test('danger et contrôle', () => {
  assert.deepEqual(stats.danger, { rmRf: 3, forcePush: 1, resetHard: 0, sudo: 1, gitCommits: 1 });
  assert.deepEqual(stats.control.permissionModes, { plan: 1, default: 10, auto: 6, acceptEdits: 3 });
  assert.equal(stats.control.plannedSessions, 2);
  assert.deepEqual(stats.control.slashCommands, { '/clear': 1, '/model': 1 });
});

test('facture dédoublonnée', () => {
  const b = stats.bill;
  const opus = b.byModel['claude-opus-4-7'];
  assert.deepEqual({ ...opus, costUsd: 0 }, { input: 8150, output: 1015, cacheRead: 5000, cacheWrite: 1100, turns: 5, costUsd: 0 });
  assert.ok(Math.abs(opus.costUsd - 0.0755) <= 0.005, `opus cost ${opus.costUsd}`);           // 0.08 ou 0.07 selon l'arrondi flottant
  assert.ok(Math.abs(b.byModel['claude-fable-5'].costUsd - 0.2265) <= 0.005);
  assert.equal(b.costUsd, 0.34); assert.equal(b.unpricedTokens, 310);
  assert.deepEqual(stats.models[0], { name: 'claude-opus-4-7', turns: 5, share: 5 / 18 });
  assert.equal(stats.models.length, 7);
  assert.deepEqual(stats.versions, { first: '2.1.133', last: '2.1.204', count: 3 });
});

test('meta et robustesse', () => {
  assert.equal(stats.meta.lowConfidence, false);
  assert.ok(!JSON.stringify(stats).includes('NaN'));
  assert.ok(!JSON.stringify(stats).includes('/Users/'));
});

test('lignes sans marqueur ou vides ne sont pas corrompues ; cwd prime sur le slug', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'fromslug', kind: 'main', sessionId: 's' });
  a.feedLine(''); a.feedLine('not json at all'); a.feedLine('{"type":"summary","summary":"x"}');
  a.feedLine('{"type":"user","cwd":"/tmp/realname","timestamp":"2026-10-01T10:00:00Z","message":{"role":"user","content":"hello"}}');
  a.feedLine('{"type":"user","message":{"role":"user","content":"no timestamp here"}}');
  a.endFile();
  const r = a.result();
  assert.equal(r.volume.corruptLines, 0); assert.equal(r.volume.humanMessages, 2);
  assert.deepEqual(r.volume.topProjects, [{ name: 'realname', sessions: 1 }]);
  assert.equal(r.meta.lowConfidence, true);
  assert.equal(r.volume.sessions, 1);
});

test('result() sur un analyseur vide ne lève pas', () => {
  const r = new Analyzer().result();
  assert.equal(r.volume.sessions, 0); assert.equal(r.bill.costUsd, 0); assert.equal(r.moments.latestHour, null);
  assert.equal(r.volume.medianCleanLength, 0); assert.equal(r.couple.talkRatio, 0);
});
