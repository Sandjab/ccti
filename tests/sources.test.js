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
