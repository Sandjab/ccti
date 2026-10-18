// tests/codex-demo.test.js — la démo CXTI est cohérente avec ses propres règles (type, sommes, facture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import DEMO from '../codex/demo.js';
import { computeProfile } from '../src/profile.js';
import { renderCard } from '../src/card.js';
import { costUsd } from '../codex/pricing.js';
import { setTool } from '../src/i18n.js';

test('la démo CXTI donne ALID, des sommes justes et une facture aux prix OpenAI', () => {
  const p = computeProfile(DEMO);
  assert.equal(p.code, 'ALID');
  assert.deepEqual(p.observations.map((o) => o.id), ['apologies', 'no_gt_thanks', 'caps', 'swear', 'ragequit']);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.equal(sum(DEMO.moments.byHour), DEMO.volume.humanMessages);
  assert.equal(sum(DEMO.moments.byWeekday), DEMO.volume.humanMessages);
  assert.equal(sum(Object.values(DEMO.control.permissionModes)), DEMO.volume.humanMessages);
  assert.equal(sum(DEMO.models.map((m) => m.turns)), DEMO.volume.assistantTurns + DEMO.volume.subagentTurns);
  let total = 0;
  for (const [name, u] of Object.entries(DEMO.bill.byModel)) {
    assert.equal(u.costUsd, Math.round(costUsd(u, name) * 100) / 100, name);
    total += u.costUsd;
  }
  assert.equal(DEMO.bill.costUsd, Math.round(total * 100) / 100);
  assert.equal(DEMO.couple.questionsAnswered, null);
  setTool('codex');
  const svg = renderCard(DEMO, p, { lang: 'fr' });
  assert.ok(svg.includes('>CCTI</text>')); assert.ok(svg.includes('· Codex'));
  assert.ok(svg.includes('Le Joueur de YOLO'));
});
