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
  assert.deepEqual({ ...opus, costUsd: 0 }, { input: 8150, output: 1015, cacheRead: 5000, cacheWrite: 1100, cacheWrite1h: 0, turns: 5, costUsd: 0 });
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

test('listSessionFiles lit les sous-agents de workflow rangés sous subagents/workflows/', async () => {
  // Format réel observé : <session>/subagents/workflows/wf_<id>/agent-<id>.jsonl (outil Workflow).
  // Sans eux, les deux tiers des sous-agents d'un utilisateur de workflows disparaissent de la facture.
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const root = mkdtempSync(path.join(tmpdir(), 'freudiff-wf-'));
  const proj = path.join(root, '-Users-x-Dev-a');
  mkdirSync(path.join(proj, 's1', 'subagents', 'workflows', 'wf_1-2'), { recursive: true });
  writeFileSync(path.join(proj, 's1.jsonl'), '\n');
  writeFileSync(path.join(proj, 's1', 'subagents', 'agent-a.jsonl'), '\n');
  writeFileSync(path.join(proj, 's1', 'subagents', 'workflows', 'wf_1-2', 'agent-b.jsonl'), '\n');
  const files = await listSessionFiles(root);
  assert.deepEqual(files.map((f) => [f.kind, f.sessionId, path.basename(f.path)]).sort(),
    [['main', 's1', 's1.jsonl'], ['subagent', 's1', 'agent-a.jsonl'], ['subagent', 's1', 'agent-b.jsonl']]);
});

// Revue finale, Important 1 : sur le corpus réel, un tour écrit sur plusieurs lignes porte un
// output_tokens croissant (première ligne en cours de flux, stop_reason null). Prendre la première
// ligne perdait ≈ 46 % des tokens de sortie, donc de la facture affichée sur la carte.
test('tour multi-lignes : usage final (le plus grand), compté une seule fois', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  const line = (out, stop) => JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: '2026-10-05T07:00:00Z',
    message: { id: 'mX', model: 'claude-opus-4-7', role: 'assistant', content: [], stop_reason: stop,
      usage: { input_tokens: 100, output_tokens: out, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } });
  a.feedLine(line(1, null));
  a.feedLine(line(500, 'end_turn'));
  a.feedLine(line(500, 'end_turn'));
  a.endFile();
  const bm = a.result().bill.byModel['claude-opus-4-7'];
  assert.equal(bm.turns, 1);
  assert.equal(bm.output, 500);
  assert.equal(bm.input, 100);
});

// Revue finale, Important 2 : les écritures de cache en TTL 1 h coûtent 2 × l'entrée, pas 1,25 ×.
test('écritures de cache 1 h séparées et facturées à 2 × l\'entrée', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  a.feedLine(JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: '2026-10-05T07:00:00Z',
    message: { id: 'mY', model: 'claude-opus-4-7', role: 'assistant', content: [],
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000,
        cache_creation: { ephemeral_5m_input_tokens: 600, ephemeral_1h_input_tokens: 400 } } } }));
  a.endFile();
  const bm = a.result().bill.byModel['claude-opus-4-7'];
  assert.equal(bm.cacheWrite, 1000);
  assert.equal(bm.cacheWrite1h, 400);
  assert.ok(Math.abs(bm.costUsd - 0.01) < 1e-9, String(bm.costUsd)); // 600 × 6,25 + 400 × 10 = 7 750 µ$ → arrondi 0,01
});

// Revue finale, Important 3 : les commandes « ! » du mode bash ne sont pas des messages à Claude.
test('mode bash (! commande) : ni message humain ni texte compté', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  const u = (content, ts) => JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content } });
  a.feedLine(u('fais le point', '2026-10-05T07:00:00Z'));
  a.feedLine(u('<bash-input>git status</bash-input>', '2026-10-05T07:01:00Z'));
  a.feedLine(u('<bash-stdout>FATAL ERROR WHAT THE FUCK</bash-stdout><bash-stderr></bash-stderr>', '2026-10-05T07:01:01Z'));
  a.endFile();
  const r = a.result();
  assert.equal(r.volume.humanMessages, 1);
  assert.equal(r.couple.humanSwear, 0);
  assert.equal(r.couple.humanCaps, 0);
});

// Finition : des horodatages désordonnés (reprise de session, lignes réinsérées) donnaient une
// « plus longue session » de durée négative sur la page.
test('durée de session = max − min des horodatages, jamais négative', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  const u = (ts) => JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content: 'go' } });
  a.feedLine(u('2026-10-05T10:00:00Z'));
  a.feedLine(u('2026-10-05T11:00:00Z'));
  a.feedLine(u('2026-10-05T09:00:00Z'));
  a.endFile();
  assert.equal(a.result().volume.longestSession.durationMin, 120);
});

// Finition : les messages « <synthetic> » sont écrits par Claude Code (erreurs d'API, coupures),
// pas par un modèle ; ils apparaissaient comme un modèle dans « Les modèles ».
test('tours <synthetic> ignorés : ni tour, ni modèle, ni facture', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  a.feedLine(JSON.stringify({ type: 'assistant', requestId: 'r', timestamp: '2026-10-05T10:00:00Z',
    message: { id: 'syn1', model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: 'API Error: sorry' }],
      usage: { input_tokens: 0, output_tokens: 0 } } }));
  a.endFile();
  const r = a.result();
  assert.equal(r.volume.assistantTurns, 0);
  assert.deepEqual(r.models, []);
  assert.deepEqual(r.bill.byModel, {});
  assert.equal(r.couple.claudeApologized, 0);
});

// Gaspillage (mesure du 17 oct. 2026 sur un corpus réel : 55 % de la facture vient des tours à
// plus de 150 k tokens de contexte ; 6,7 % est du surcoût de cache reconstruit après une pause).
test('gaspillage : gros contextes, compactions, cache reconstruit après une pause', () => {
  const a = new Analyzer();
  a.beginFile({ project: 'p', kind: 'main', sessionId: 's' });
  const turn = (id, ts, usage) => JSON.stringify({ type: 'assistant', requestId: `r-${id}`, timestamp: ts,
    message: { id, model: 'claude-opus-4-7', role: 'assistant', content: [], usage } });
  // A : 160 k de contexte (10 k entrée + 150 k cache lu), sortie en flux 100 → 500.
  a.feedLine(turn('A', '2026-10-05T10:00:00Z', { input_tokens: 10000, output_tokens: 100, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0 }));
  a.feedLine(turn('A', '2026-10-05T10:00:05Z', { input_tokens: 10000, output_tokens: 500, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0 }));
  // B : 10 min plus tard, le cache 5 min a expiré : 50 k réécrits, rien de relu.
  a.feedLine(turn('B', '2026-10-05T10:10:00Z', { input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 50000 }));
  a.feedLine(JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: '2026-10-05T10:20:00Z' }));
  // C : 80 min plus tard, 20 k réécrits (pause longue).
  a.feedLine(turn('C', '2026-10-05T11:30:00Z', { input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 20000 }));
  // D : 1 min plus tard, petite écriture : pas une reconstruction.
  a.feedLine(turn('D', '2026-10-05T11:31:00Z', { input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 21000, cache_creation_input_tokens: 2000 }));
  a.endFile();
  const w = a.result().waste;
  assert.equal(w.turnsOver150k, 1);
  assert.equal(w.turnsOver150kShare, 0.25);
  assert.equal(w.costOver150kUsd, 0.14);       // 10 000 × 5 + 150 000 × 0,5 + 500 × 25 = 137 500 µ$
  assert.equal(w.maxContext, 160000);
  assert.equal(w.compactions, 1);
  assert.equal(w.cacheRebuilds, 2);
  assert.equal(w.cacheRebuildsShortPause, 1);
  assert.equal(w.cacheRebuildExcessUsd, 0.4);  // (50 000 + 20 000) × (6,25 − 0,5) = 402 500 µ$
  assert.ok(w.costOver150kShare > 0 && w.costOver150kShare < 1);
});
