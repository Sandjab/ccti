// tests/codex-files.test.js — tri des fichiers déposés (spec CXTI § 2.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, accept } from '../codex/files.js';

const F = (rel) => ({ file: { name: rel.split('/').pop() }, rel });

// Déposer ~/.codex entier : seules les sessions rollout comptent, le reste de l'outil est ignoré.
test('~/.codex entier : seuls les rollout-* sont gardés', () => {
  const out = classify([
    F('.codex/history.jsonl'), F('.codex/session_index.jsonl'), F('.codex/state_5.sqlite'), F('.codex/log/codex-tui.log'),
    F('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
    F('.codex/archived_sessions/rollout-2026-09-01T10-00-00-z9.jsonl'),
  ]);
  assert.deepEqual(out.map((o) => o.sessionId), ['rollout-2026-10-05T22-00-00-a1', 'rollout-2026-09-01T10-00-00-z9']);
  assert.ok(out.every((o) => !o.zst));
});

test('les .jsonl.zst sont gardés pour être décompressés, marqués zst', () => {
  const out = classify([F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.deepEqual(out.map((o) => [o.sessionId, o.zst]), [['rollout-2026-09-01T10-00-00-f6', true]]);
});

// zstd -d garde l'archive : la même session sous les deux formes n'est lue qu'une fois, en .jsonl (spec .zst, décision 5).
test('même lot : l\'archive d\'une session présente en .jsonl est écartée', () => {
  const out = classify([
    F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst'),
    F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl'),
  ]);
  assert.deepEqual(out.map((o) => [o.sessionId, !!o.zst]), [['rollout-2026-09-01T10-00-00-f6', false]]);
});

test('accept : jsonl et jsonl.zst seulement', () => {
  assert.ok(accept('rollout-x.jsonl')); assert.ok(accept('rollout-x.jsonl.zst'));
  assert.ok(!accept('state_5.sqlite')); assert.ok(!accept('notes.md'));
});
