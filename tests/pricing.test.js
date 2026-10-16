// tests/pricing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, costUsd } from '../src/pricing.js';

test('préfixe le plus long', () => {
  assert.deepEqual(priceFor('claude-opus-4-7'), { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
  assert.deepEqual(priceFor('claude-opus-4-1-20250805'), { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 });
  assert.deepEqual(priceFor('claude-opus-5-5'), { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  assert.deepEqual(priceFor('claude-fable-5-1'), { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 });
  assert.deepEqual(priceFor('claude-fable-5'), { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 });
  assert.deepEqual(priceFor('claude-haiku-4-5-20251001'), { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 });
});

test('repli par famille', () => {
  assert.deepEqual(priceFor('claude-opus-9'), { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
  assert.deepEqual(priceFor('claude-3-5-sonnet-20241022'), { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
  assert.equal(priceFor('claude-weird-9'), null);
  assert.equal(priceFor('<synthetic>'), null);
  assert.equal(priceFor(''), null);
});

test('coût de référence', () => {
  const u = { input: 8150, output: 1015, cacheRead: 5000, cacheWrite: 1100 };
  assert.ok(Math.abs(costUsd(u, 'claude-opus-4-7') - 0.0755) < 1e-9);
  assert.equal(costUsd(u, 'claude-weird-9'), null);
  assert.equal(costUsd({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 'claude-sonnet-4-6'), 0);
});
