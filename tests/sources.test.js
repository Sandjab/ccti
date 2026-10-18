// tests/sources.test.js — chaque fichier déposé est rattaché à son outil (spec CCTI Claude+Codex § 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, accept } from '../src/sources.js';

const F = (rel) => ({ file: { name: rel.split('/').pop() }, rel });
const tools = (out) => out.map((o) => `${o.tool}:${o.sessionId}`);

test('Claude seul : tri inchangé', () => {
  const out = classify([F('projects/-Users-x-Dev-a/s1.jsonl'), F('projects/-Users-x-Dev-a/s1/subagents/agent-1.jsonl')]);
  assert.deepEqual(tools(out), ['claude:s1', 'claude:s1']);
});

test('.claude et .codex déposés ensemble : les deux outils', () => {
  const out = classify([
    F('.claude/projects/-Users-x-Dev-a/s1.jsonl'),
    F('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
    F('.codex/history.jsonl'),
  ]);
  assert.deepEqual(tools(out), ['claude:s1', 'codex:rollout-2026-10-05T22-00-00-a1']);
});

// ~/.codex contient d'autres .jsonl (historique, index) : ils ne doivent pas créer un bilan Claude fantôme.
test('~/.codex seul : aucun fichier Claude', () => {
  const out = classify([
    F('.codex/history.jsonl'), F('.codex/session_index.jsonl'),
    F('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
  ]);
  assert.deepEqual(tools(out), ['codex:rollout-2026-10-05T22-00-00-a1']);
});

test('un dossier de jour Codex glissé seul n\'est pas un projet Claude', () => {
  const out = classify([F('05/rollout-2026-10-05T22-00-00-a1.jsonl'), F('05/rollout-2026-10-05T23-00-00-a2.jsonl')]);
  assert.ok(out.every((o) => o.tool === 'codex'));
  assert.equal(out.length, 2);
});

test('fichiers compressés seuls : items Codex marqués skip', () => {
  const out = classify([F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.deepEqual(out.map((o) => [o.tool, o.skip]), [['codex', true]]);
});

test('accept : jsonl et jsonl.zst', () => {
  assert.ok(accept('a.jsonl')); assert.ok(accept('rollout-a.jsonl.zst')); assert.ok(!accept('notes.md'));
});

// « Ajouter un dossier » : chaque lot est trié avec son propre contexte, puis ajouté. Retrier le tout
// ensemble faisait disparaître des sessions déjà affichées (revue de branche, Important 2).
import { addBatch } from '../src/sources.js';
const G = (rel, file = { name: rel.split('/').pop(), size: 1, lastModified: 1 }) => ({ file, rel });

test('ajout : un dossier enfant puis son parent ne fait perdre aucun projet', () => {
  const s1 = G('-Users-x-Dev-a/s1.jsonl'), s2 = G('-Users-x-Dev-b/s2.jsonl');
  const first = addBatch([], [s1]);
  const second = addBatch(first.items, [G('projects/-Users-x-Dev-a/s1.jsonl', s1.file), G('projects/-Users-x-Dev-b/s2.jsonl', s2.file)]);
  assert.deepEqual(second.items.map((o) => `${o.tool}:${o.sessionId}`).sort(), ['claude:s1', 'claude:s2']);
  assert.equal(second.added, 1);
});

test('ajout : une sauvegarde Claude hors projects/ puis ~/.codex garde les sessions Claude', () => {
  const first = addBatch([], [G('backup/-Users-x-Dev-a/s1.jsonl')]);
  const second = addBatch(first.items, [G('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl')]);
  assert.deepEqual(second.items.map((o) => o.tool), ['claude', 'codex']);
  assert.equal(second.added, 1);
});

test('ajout : un dossier Codex compressé seulement n\'ajoute aucune session lisible', () => {
  const first = addBatch([], [G('projects/-Users-x-Dev-a/s1.jsonl')]);
  const second = addBatch(first.items, [G('.codex/sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.equal(second.added, 0);
});

// Issue #1 : chaque fichier examiné tombe dans une catégorie comptée, et la somme des catégories
// est le nombre de fichiers examinés. Aucun nom ni chemin dans le reçu, seulement des nombres.
import { coverage } from '../src/sources.js';

test('reçu de couverture : sessions, archives, index, non reconnus', () => {
  const entries = [
    G('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
    G('.codex/sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst'),
    G('.codex/history.jsonl'), G('.codex/session_index.jsonl'),
    G('.codex/notes/other.jsonl'),
  ];
  const { items } = addBatch([], entries);
  const c = coverage(entries, items);
  assert.deepEqual(c, { examined: 5, claude: 0, codex: 1, compressed: 1, index: 2, unrecognized: 1 });
  const { examined, ...parts } = c;
  assert.equal(Object.values(parts).reduce((a, b) => a + b, 0), examined);
  assert.ok(Object.values(c).every(Number.isInteger));
});

test('reçu : un fichier atteint deux fois n\'est examiné qu\'une fois', () => {
  const e = G('projects/-Users-x-Dev-a/s1.jsonl');
  const entries = [e, G('-Users-x-Dev-a/s1.jsonl', e.file)];
  const { items } = addBatch([], [e]);
  assert.deepEqual(coverage(entries, items), { examined: 1, claude: 1, codex: 0, compressed: 0, index: 0, unrecognized: 0 });
});
