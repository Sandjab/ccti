// tests/profile.test.js
process.env.TZ = 'Europe/Paris';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { computeAxes, typeCode, computeProfile, OBSERVATIONS, THRESHOLDS } from '../src/profile.js';
import { analyzeDirectory } from '../scripts/lib/walk.mjs';

// Stats minimales construites à la main : tout à zéro sauf ce que le test fixe.
function mk(over = {}) {
  const base = {
    meta: { lowConfidence: false },
    volume: { sessions: 100, humanMessages: 1000, assistantTurns: 2000, medianCleanLength: 100, plannedSessions: 0, projects: 5, subagents: 0, longestStreakDays: 3, claudeWorkMinutes: 100 },
    moments: { eveningShare: 0.1, afterMidnightShare: 0, allNighters: 0 },
    couple: { interruptions: 0, toolDenials: 0, claudeAgreed: 0, absolutelyRight: 0, claudeApologized: 0, humanNo: 0, humanThanks: 0, humanCaps: 0, humanSwear: 0, rageQuits: 0, questionsAsked: 0, questionsAnswered: 0, patienceMedianSec: 60 },
    danger: { rmRf: 0, forcePush: 0 },
    control: { permissionModes: { default: 1000 }, plannedSessions: 0 },
    bill: { costUsd: 0 },
    models: [{ name: 'a' }],
  };
  for (const [k, v] of Object.entries(over)) base[k] = { ...base[k], ...v };
  return base;
}

test('axes et code sur stats construites', () => {
  assert.deepEqual(computeAxes(mk()), { A: 30, V: 25, P: 0, N: 10 });
  assert.equal(typeCode(computeAxes(mk())), 'CLID');
  const auto = mk({ control: { permissionModes: { auto: 1000 } }, volume: { medianCleanLength: 400 }, moments: { eveningShare: 0.5 } });
  auto.control.plannedSessions = 50;
  assert.deepEqual(computeAxes(auto), { A: 100, V: 100, P: 50, N: 50 });
  assert.equal(typeCode(computeAxes(auto)), 'AVPN');
});

test('friction fait chuter l\'autonomie', () => {
  const s = mk({ control: { permissionModes: { auto: 1000 } }, couple: { interruptions: 50, toolDenials: 50 } });
  assert.equal(computeAxes(s).A, 70); // 10 × 0.1 = 1 → composante confiance à 0
});

test('seuils exacts', () => {
  assert.equal(typeCode({ A: 50, V: 50, P: 33, N: 35 }), 'AVPN');
  assert.equal(typeCode({ A: 49, V: 49, P: 32, N: 34 }), 'CLID');
  assert.deepEqual(THRESHOLDS, { A: 50, V: 50, P: 33, N: 35 });
});

test('les 16 codes sont atteignables', () => {
  const codes = new Set();
  for (const A of [0, 100]) for (const V of [0, 100]) for (const P of [0, 100]) for (const N of [0, 100]) codes.add(typeCode({ A, V, P, N }));
  assert.equal(codes.size, 16);
});

test('dénominateurs nuls', () => {
  const s = mk({ volume: { sessions: 0, humanMessages: 0, medianCleanLength: 0 }, control: { permissionModes: {} }, moments: { eveningShare: 0 } });
  assert.deepEqual(computeAxes(s), { A: 30, V: 0, P: 0, N: 0 });
});

test('observations : ordre, limite, formats', () => {
  const s = mk({ moments: { eveningShare: 0.5, afterMidnightShare: 0.2, allNighters: 3 }, couple: { humanCaps: 2, humanSwear: 1, rageQuits: 5, claudeAgreed: 100 }, danger: { rmRf: 4, forcePush: 1 }, bill: { costUsd: 1234 } });
  const p = computeProfile(s);
  assert.deepEqual(p.observations.map((o) => o.id), ['night', 'midnight', 'allnighters', 'agreed', 'caps']);
  assert.deepEqual(p.observations[0], { id: 'night', fmt: 'pct', n: 0.5 });
  assert.equal(computeProfile(s, 10).observations.length, 10);
  assert.ok(OBSERVATIONS.every((o) => ['int', 'pct', 'usd', 'hours', 'sec'].includes(o.fmt)));
  assert.equal(OBSERVATIONS.length, 24);
});

test('profil des fixtures', async () => {
  const { stats } = await analyzeDirectory('tests/fixtures/projects');
  const p = computeProfile(stats);
  assert.deepEqual(p.axes, { A: 32, V: 4, P: 29, N: 20 });
  assert.equal(p.code, 'CLID');
  assert.deepEqual(p.observations.map((o) => o.id), ['midnight', 'caps', 'swear', 'ragequit', 'rmrf']);
  assert.equal(p.lowConfidence, false);
});
