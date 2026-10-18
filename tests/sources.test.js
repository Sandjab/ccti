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

test('fichiers compressés seuls : items Codex marqués zst', () => {
  const out = classify([F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.deepEqual(out.map((o) => [o.tool, o.zst]), [['codex', true]]);
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

test('ajout : un dossier Codex compressé seulement ajoute une session lisible', () => {
  const first = addBatch([], [G('projects/-Users-x-Dev-a/s1.jsonl')]);
  const second = addBatch(first.items, [G('.codex/sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.equal(second.added, 1);
  assert.deepEqual(second.items.map((o) => [o.tool, !!o.zst]), [['claude', false], ['codex', true]]);
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
  assert.deepEqual(c, { examined: 5, claude: 0, codex: 1, compressed: 1, duplicates: 0, index: 2, unrecognized: 1 });
  const { examined, ...parts } = c;
  assert.equal(Object.values(parts).reduce((a, b) => a + b, 0), examined);
  assert.ok(Object.values(c).every(Number.isInteger));
});

test('reçu : un fichier atteint deux fois n\'est examiné qu\'une fois', () => {
  const e = G('projects/-Users-x-Dev-a/s1.jsonl');
  const entries = [e, G('-Users-x-Dev-a/s1.jsonl', e.file)];
  const { items } = addBatch([], [e]);
  assert.deepEqual(coverage(entries, items), { examined: 1, claude: 1, codex: 0, compressed: 0, duplicates: 0, index: 0, unrecognized: 0 });
});

// Review Focus 4 : une session sous les deux formes n'est lue qu'une fois, quel que soit l'ordre (spec .zst, décision 5).
const ID = 'rollout-2026-09-01T10-00-00-f6';
const PLAIN = G(`.codex/sessions/2026/09/01/${ID}.jsonl`), ARCH = G(`.codex/sessions/2026/09/01/${ID}.jsonl.zst`);
const sum = ({ examined, ...parts }) => [examined, Object.values(parts).reduce((a, b) => a + b, 0)];

test('doublon dans un même lot : le .jsonl est lu, l\'archive comptée en duplicates', () => {
  const { items, dups } = addBatch([], [ARCH, PLAIN]);
  assert.deepEqual(items.map((o) => !!o.zst), [false]);
  const c = coverage([ARCH, PLAIN], items, dups);
  assert.equal(c.codex, 1); assert.equal(c.compressed, 0); assert.equal(c.duplicates, 1);
  const [examined, total] = sum(c); assert.equal(total, examined);
});

test('doublon par ajout, .jsonl puis archive : rien d\'ajouté', () => {
  const first = addBatch([], [PLAIN]);
  const second = addBatch(first.items, [ARCH]);
  assert.equal(second.added, 0);
  assert.deepEqual(second.items.map((o) => !!o.zst), [false]);
  assert.equal(coverage([PLAIN, ARCH], second.items, second.dups).duplicates, 1);
});

test('doublon par ajout, archive puis .jsonl : le .jsonl remplace l\'archive', () => {
  const first = addBatch([], [ARCH]);
  const second = addBatch(first.items, [PLAIN]);
  assert.deepEqual(second.items.map((o) => [o.sessionId, !!o.zst]), [[ID, false]]);
  const c = coverage([ARCH, PLAIN], second.items, second.dups);
  assert.equal(c.duplicates, 1); assert.equal(c.compressed, 0);
  const [examined, total] = sum(c); assert.equal(total, examined);
});

// Issue #2, point 2 : un fichier réajouté après avoir grandi n'est lu qu'une fois, dans sa dernière version.
const S1 = 'projects/-Users-x-Dev-a/s1.jsonl';
const at = (rel, size, lastModified) => G(rel, { name: rel.split('/').pop(), size, lastModified });

test('fichier réajouté après avoir grandi : la nouvelle version remplace l\'ancienne', () => {
  const old = at(S1, 10, 1), grown = at(S1, 20, 2);
  const first = addBatch([], [old]);
  const second = addBatch(first.items, [grown]);
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0].file, grown.file);
  assert.equal(second.added, 1);
  assert.deepEqual([...second.touched], ['claude']);
  const c = coverage([old, grown], second.items, [...first.dups, ...second.dups]);
  assert.equal(c.claude, 1); assert.equal(c.duplicates, 1);
  const [examined, total] = sum(c); assert.equal(total, examined);
});

test('version plus ancienne réajoutée : rien d\'ajouté, elle compte en doublon', () => {
  const grown = at(S1, 20, 2), old = at(S1, 10, 1);
  const first = addBatch([], [grown]);
  const second = addBatch(first.items, [old]);
  assert.equal(second.added, 0);
  assert.equal(second.touched.size, 0);
  assert.deepEqual(second.items.map((o) => o.file), [grown.file]);
  assert.equal(coverage([grown, old], second.items, second.dups).duplicates, 1);
});

test('même date : la plus grosse version l\'emporte ; égalité totale : la version déjà retenue reste', () => {
  const small = at(S1, 10, 5), big = at(S1, 20, 5);
  assert.equal(addBatch(addBatch([], [small]).items, [big]).items[0].file, big.file);
  const a = at(S1, 10, 5), b = at(S1, 10, 5);
  b.file = { ...b.file }; // même nom, même taille, même date, mais un autre objet File : même clé, ignoré
  assert.equal(addBatch(addBatch([], [a]).items, [b]).items[0].file, a.file);
});

test('deux fichiers de sous-agents d\'une même session Claude : tous deux retenus', () => {
  const { items } = addBatch([], [G('projects/-Users-x-Dev-a/s1/subagents/agent-1.jsonl'), G('projects/-Users-x-Dev-a/s1/subagents/agent-2.jsonl')]);
  assert.equal(items.length, 2);
});

test('une session Codex dans deux dossiers d\'un même lot : une seule retenue, la plus récente', () => {
  const name = 'rollout-2026-10-05T22-00-00-a1.jsonl';
  const a = at(`.codex/sessions/2026/10/05/${name}`, 10, 1), b = at(`.codex/archived_sessions/${name}`, 10, 2);
  const { items, dups } = addBatch([], [a, b]);
  assert.deepEqual(items.map((o) => o.file), [b.file]);
  assert.equal(coverage([a, b], items, dups).duplicates, 1);
});
