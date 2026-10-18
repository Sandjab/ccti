// tests/codex-pricing.test.js — facture CXTI (spec CXTI § 4.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, costUsd } from '../codex/pricing.js';

test('variantes -codex et suffixes : prix de la famille, le préfixe le plus long gagne', () => {
  assert.deepEqual(priceFor('gpt-5.2-codex'), { input: 1.75, cacheRead: 0.175, cacheWrite: 1.75, output: 14 });
  assert.equal(priceFor('gpt-5.1-codex-mini').input, 0.25);
  assert.equal(priceFor('gpt-5.1-codex-max').input, 1.25);
  assert.equal(priceFor('gpt-6-astra').cacheWrite, 12.5);
});

// Un modèle sorti après le relevé ne doit pas être facturé au prix d'un ancien : il passe en non tarifé.
test('un modèle inconnu n\'hérite pas du prix d\'un préfixe plus court', () => {
  assert.equal(priceFor('gpt-5.7'), null);
  assert.equal(priceFor('gpt-6'), null);
  assert.equal(costUsd({ input: 1e6 }, 'mystery'), null);
});

test('coût : entrée hors cache, cache lu, cache écrit, sortie', () => {
  assert.equal(costUsd({ input: 1_000_000, cacheRead: 2_000_000, cacheWrite: 0, output: 150_000 }, 'gpt-5.2-codex').toFixed(2), '4.20');
  assert.equal(costUsd({ input: 60_000, cacheRead: 0, cacheWrite: 40_000, output: 10_000 }, 'gpt-6-astra').toFixed(2), '1.60');
});

// OpenAI facture une écriture en cache au tarif d'entrée quand le modèle n'a pas de prix d'écriture :
// elle ne doit pas sortir gratuitement de la facture.
test('écriture en cache sans prix propre : tarif d\'entrée', () => {
  assert.equal(costUsd({ cacheWrite: 1_000_000 }, 'gpt-5.5'), 5);
  assert.equal(costUsd({ cacheWrite: 1_000_000 }, 'gpt-6-astra'), 12.5);
});

// Les variantes -mini, -nano, -pro ont leur propre prix (souvent très différent) : sans ligne à elles,
// elles restent non tarifées au lieu d'hériter du prix du modèle parent.
test('-mini, -nano, -pro n\'héritent pas du prix du parent', () => {
  for (const m of ['gpt-5-mini', 'gpt-5-nano', 'o3-mini', 'o3-pro', 'gpt-5.4-mini']) assert.equal(priceFor(m), null, m);
  assert.equal(priceFor('gpt-5.1-codex-mini').input, 0.25);
  assert.equal(priceFor('gpt-5-codex').input, 1.25);
});
