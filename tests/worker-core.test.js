// tests/worker-core.test.js — un dépôt mixte donne un bilan par outil, jamais un bilan fusionné
// (spec CCTI Claude+Codex § 3).
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { zstdCompressSync, constants } from 'node:zlib';
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

// Issue #1 : un fichier illisible est compté à part, pas confondu avec une ligne corrompue.
test('fichier illisible : compté par outil, aucune ligne corrompue inventée', async () => {
  const broken = { name: 'x.jsonl', stream() { throw new Error('NotReadableError'); } };
  const r = await run([{ tool: 'claude', file: broken, slug: '-Users-test-Dev-beta', kind: 'main', sessionId: 'x' }]);
  assert.deepEqual(r.unreadable, { claude: 1 });
  assert.equal(r.reports.claude.volume.corruptLines, 0);
});

// spec .zst : une session compressée donne exactement le bilan du .jsonl d'origine.
const zst = (buf, level) => zstdCompressSync(buf, { params: { [constants.ZSTD_c_compressionLevel]: level } });
const strip = ({ meta, ...rest }) => rest; // meta.generatedAt change à chaque bilan

test('session .zst : même bilan que le .jsonl d\'origine (niveaux 3 et 19)', async () => {
  const raw = readFileSync(CODEX);
  const plain = strip((await run([{ tool: 'codex', file: file(CODEX), sessionId: 'a1' }])).reports.codex);
  for (const level of [3, 19]) {
    const r = await run([{ tool: 'codex', file: new File([zst(raw, level)], 'a1.jsonl.zst'), sessionId: 'a1', zst: true }]);
    assert.deepEqual(r.unreadable, {});
    assert.deepEqual(strip(r.reports.codex), plain, `niveau ${level}`);
  }
});

// Review Focus 1 : des lignes et des caractères accentués coupés entre blocs, côté compressé et décompressé.
test('gros .zst : lignes recollées entre blocs, même bilan', async () => {
  const noise = Array.from({ length: 6000 }, (_, i) => JSON.stringify({ type: 'bruit', i, s: 'é' + randomBytes(96).toString('hex') })).join('\n') + '\n';
  const raw = Buffer.concat([Buffer.from(noise), readFileSync(CODEX), Buffer.from(noise)]);
  const z = zst(raw, 3);
  assert.ok(z.length > 3 * 65536, 'le flux compressé doit arriver en plusieurs blocs');
  const plain = strip((await run([{ tool: 'codex', file: new File([raw], 'a1.jsonl'), sessionId: 'a1' }])).reports.codex);
  const r = await run([{ tool: 'codex', file: new File([z], 'a1.jsonl.zst'), sessionId: 'a1', zst: true }]);
  assert.deepEqual(strip(r.reports.codex), plain);
  assert.equal(r.reports.codex.volume.humanMessages, 2);
});

// Review Focus 2 : un .zst tronqué ou faux est compté parmi les archives illisibles, la suite est lue.
test('.zst tronqué ou faux : illisible, compté dans compressed, les autres fichiers sont lus', async () => {
  const z = zst(readFileSync(CODEX), 19);
  const r = await run([
    { tool: 'codex', file: new File([z.subarray(0, 20)], 't.jsonl.zst'), sessionId: 't', zst: true },
    { tool: 'codex', file: new File(['not really zstd'], 'f.jsonl.zst'), sessionId: 'f', zst: true },
    { tool: 'codex', file: file(CODEX), sessionId: 'a1' },
  ]);
  assert.deepEqual(r.unreadable, { compressed: 2 });
  assert.equal(r.reports.codex.volume.sessions, 1);
  assert.equal(r.reports.codex.volume.corruptLines, 0);
});

// Review Focus 3 : un .zst vide se lit comme un .jsonl vide.
test('.zst vide : lu, aucune ligne, pas illisible', async () => {
  const r = await run([{ tool: 'codex', file: new File([], 'e.jsonl.zst'), sessionId: 'e', zst: true }]);
  assert.deepEqual(r.unreadable, {});
  assert.equal(r.reports.codex.volume.sessions, 0);
});
