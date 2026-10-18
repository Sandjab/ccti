// tests/worker-core.test.js — un dépôt mixte donne un bilan par outil, jamais un bilan fusionné
// (spec CCTI Claude+Codex § 3).
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Analyzer, projectFromSlug } from '../src/analyzer.js';
import { CodexAnalyzer } from '../codex/analyzer.js';

const messages = [];
globalThis.self = { postMessage: (m) => messages.push(m) };
const { runWorker } = await import('../src/worker-core.js');
runWorker({
  claude: { make: () => new Analyzer(), info: (it) => ({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId }) },
  codex: { make: () => new CodexAnalyzer(), info: (it) => ({ sessionId: it.sessionId }) },
});
const file = (p) => new File([readFileSync(p)], p.split('/').pop());
const CLAUDE = 'tests/fixtures/projects/-Users-test-Dev-beta/b5555555-0000-0000-0000-000000000005.jsonl';
const CODEX = 'tests/fixtures-codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl';

async function run(files) {
  messages.length = 0;
  await self.onmessage({ data: { type: 'start', files } });
  return messages.at(-1);
}

test('dépôt mixte : deux bilans séparés', async () => {
  const r = await run([
    { tool: 'claude', file: file(CLAUDE), slug: '-Users-test-Dev-beta', kind: 'main', sessionId: 'b5' },
    { tool: 'codex', file: file(CODEX), sessionId: 'a1' },
  ]);
  assert.equal(r.type, 'result');
  assert.deepEqual(Object.keys(r.reports), ['claude', 'codex']);
  assert.equal(r.reports.codex.volume.sessions, 1);
  assert.equal(r.reports.codex.volume.humanMessages, 2);
  assert.ok(r.reports.claude.bill.byModel['gpt-5.2-codex'] === undefined); // aucun token Codex côté Claude
});

test('un seul outil : un seul bilan', async () => {
  const r = await run([{ tool: 'codex', file: file(CODEX), sessionId: 'a1' }]);
  assert.deepEqual(Object.keys(r.reports), ['codex']);
});

test('fichier compressé : compté côté Codex, non lu', async () => {
  const r = await run([{ tool: 'codex', file: new File(['x'], 'r.jsonl.zst'), sessionId: 'f', skip: true }]);
  assert.equal(r.reports.codex.volume.compressedSkipped, 1);
});
