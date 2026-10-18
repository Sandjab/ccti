// tests/privacy.test.js — le JSON exporté ne contient ni texte de conversation ni chemin (spec § 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('aucune string > 80 caractères, aucun chemin, hors meta', () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'ccti-')), 'stats.json');
  execFileSync(process.execPath, ['scripts/cli.mjs', 'tests/fixtures/projects', '--json', out], { stdio: 'pipe' });
  const { stats, profile } = JSON.parse(readFileSync(out, 'utf8'));
  const strings = [];
  const walk = (v, p) => {
    if (typeof v === 'string') strings.push([p, v]);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk({ ...stats, meta: undefined }, 'stats');
  walk(profile, 'profile');
  assert.ok(strings.length > 5);
  for (const [p, v] of strings) {
    assert.ok(v.length <= 80, `${p} trop long (${v.length})`);
    assert.ok(!/[\\/]/.test(v), `${p} contient un chemin : ${v}`);
  }
});
