// tests/files.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/files.js';

const F = (rel) => ({ file: { name: rel.split('/').pop() }, rel });

test('sélecteur sur projects/ (pas de racine commune)', () => {
  const out = classify([F('-Users-x-Dev-a/s1.jsonl'), F('-Users-y-Dev-b/s2.jsonl'), F('-Users-x-Dev-a/s1/subagents/agent-1.jsonl'), F('-Users-x-Dev-a/memory/notes.md')]);
  assert.deepEqual(out.map((o) => [o.slug, o.kind, o.sessionId]), [['-Users-x-Dev-a', 'main', 's1'], ['-Users-y-Dev-b', 'main', 's2'], ['-Users-x-Dev-a', 'subagent', 's1']]);
});

test('input webkitdirectory : racine projects/ puis .claude/ puis fixtures/', () => {
  for (const root of ['projects', '.claude/projects', 'fixtures/projects', 'projects copy']) {
    const out = classify([F(`${root}/-Users-x-Dev-a/s1.jsonl`), F(`${root}/-Users-x-Dev-a/s1/subagents/agent-1.jsonl`), F(`${root}/-Users-y-Dev-b/s2.jsonl`)]);
    assert.equal(out.length, 3, root);
    assert.deepEqual(out.map((o) => o.kind), ['main', 'subagent', 'main'], root);
    assert.equal(out[0].slug, '-Users-x-Dev-a', root);
  }
});

test('un seul projet via le sélecteur : pas de racine retirée', () => {
  const out = classify([F('C--Users-x-Dev-a/s1.jsonl'), F('C--Users-x-Dev-a/s1/subagents/agent-1.jsonl')]);
  assert.deepEqual(out.map((o) => [o.slug, o.kind]), [['C--Users-x-Dev-a', 'main'], ['C--Users-x-Dev-a', 'subagent']]);
});

test('rien de valide → tableau vide', () => {
  assert.deepEqual(classify([F('notes.md'), F('a/b/c/d/e.jsonl')]), []);
  assert.deepEqual(classify([]), []);
});

test('sous-agents de workflow rangés sous subagents/workflows/ (spec § 3.1 : tout .jsonl plus profond)', () => {
  const out = classify([F('projects/-Users-x-Dev-a/s1.jsonl'), F('projects/-Users-x-Dev-a/s1/subagents/workflows/wf_1-2/agent-b.jsonl')]);
  assert.deepEqual(out.map((o) => [o.slug, o.kind, o.sessionId]), [['-Users-x-Dev-a', 'main', 's1'], ['-Users-x-Dev-a', 'subagent', 's1']]);
});

// Finition : en déposant ~/.claude, history.jsonl devenait une session (slug « .claude ») vide.
test('dossier .claude/ : seuls les fichiers sous projects/ comptent', () => {
  const out = classify([F('.claude/history.jsonl'), F('.claude/projects/-Users-x-Dev-a/s1.jsonl'), F('.claude/projects/-Users-x-Dev-a/s1/subagents/agent-1.jsonl')]);
  assert.deepEqual(out.map((o) => [o.slug, o.kind]), [['-Users-x-Dev-a', 'main'], ['-Users-x-Dev-a', 'subagent']]);
});
