// tests/demo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import DEMO_STATS from '../src/demo.js';
import { computeProfile } from '../src/profile.js';
import { renderCard } from '../src/card.js';

test('la démo est cohérente et donne AVPN', () => {
  const p = computeProfile(DEMO_STATS);
  assert.equal(p.code, 'AVPN');
  assert.deepEqual(p.observations.map((o) => o.id), ['night', 'allnighters', 'agreed', 'absolutely', 'apologies']);
  assert.equal(DEMO_STATS.moments.byHour.reduce((a, b) => a + b, 0), DEMO_STATS.volume.humanMessages);
  assert.equal(DEMO_STATS.moments.byWeekday.reduce((a, b) => a + b, 0), DEMO_STATS.volume.humanMessages);
  assert.equal(Object.values(DEMO_STATS.control.permissionModes).reduce((a, b) => a + b, 0), DEMO_STATS.volume.humanMessages);
  assert.equal(DEMO_STATS.models.reduce((a, m) => a + m.turns, 0), DEMO_STATS.volume.assistantTurns + DEMO_STATS.volume.subagentTurns);
  assert.ok(renderCard(DEMO_STATS, p, { lang: 'fr' }).includes("L&#39;Architecte noctambule"));
});
