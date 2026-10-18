// tests/codex-privacy.test.js — le JSON exporté d'un bilan Codex ne contient ni texte de conversation ni chemin
// (spec CXTI § 5, même règle que tests/privacy.test.js).
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDir } from './codex-helpers.js';
import { computeProfile } from '../src/profile.js';

test('aucune string > 80 caractères, aucun chemin, hors meta', () => {
  const stats = analyzeDir('tests/fixtures-codex');
  const profile = computeProfile(stats);
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
