// tests/bundle.test.js — le fichier autonome embarque fzstd tel quel et sait l'assembler (spec .zst § 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { zstdCompressSync } from 'node:zlib';
import { wrap } from '../scripts/lib/bundle.mjs';

const MARK = '// ---- fzstd@0.1.1, esm/index.mjs, inchangé ci-dessous ----\n';
const load = (file, src) => new Function(`${wrap(file, src)}\nreturn __m_${file.replace(/\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_')};`)();

test('wrap : export var et export { … } deviennent des exports du module', () => {
  const m = load('vendor/x.js', 'export var A = 1;\nfunction B() { return 2; }\nexport { B };\n');
  assert.equal(m.A, 1);
  assert.equal(m.B(), 2);
});

// Une forme d'export non réécrite laisserait un `export` dans un script classique : le fichier autonome casserait.
test('wrap : une forme d\'export inconnue fait échouer l\'assemblage', () => {
  assert.throws(() => wrap('src/x.js', "export * from './y.js';\n"), /export/);
  assert.throws(() => wrap('src/x.js', 'const a = 1;\nexport { a as b };\n'), /export/);
});

test('vendor/fzstd.js : corps identique à fzstd@0.1.1, licence MIT en tête', () => {
  const src = readFileSync('vendor/fzstd.js', 'utf8');
  const at = src.indexOf(MARK);
  assert.ok(at > 0, 'ligne de séparation absente');
  assert.match(src.slice(0, at), /MIT License/);
  assert.equal(createHash('sha256').update(src.slice(at + MARK.length)).digest('hex'),
    '1a901fc5a58c349bbdb4f2aa1e688637ef56891ec58243a9f0cd863166b0d2a4');
});

test('fzstd assemblé par wrap décompresse un flux zstd', () => {
  const m = load('vendor/fzstd.js', readFileSync('vendor/fzstd.js', 'utf8'));
  const text = 'déjà vu\n'.repeat(100);
  assert.equal(new TextDecoder().decode(m.decompress(zstdCompressSync(Buffer.from(text)))), text);
  assert.equal(typeof m.Decompress, 'function');
});
