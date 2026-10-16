// tests/card.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard, THEMES, esc } from '../src/card.js';

const stats = { volume: { sessions: 7, firstDay: '2026-10-05', lastDay: '2026-10-12' }, couple: { claudeAgreed: 4 }, bill: { costUsd: 0.34 } };
const profile = { code: 'CLID', axes: { A: 32, V: 4, P: 29, N: 20 } };

test('SVG autonome, bilingue, deux thèmes', () => {
  const fr = renderCard(stats, profile, { lang: 'fr', theme: 'light' });
  assert.ok(fr.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"'));
  assert.ok(fr.includes('Le Tireur d&#39;élite'));
  assert.ok(fr.includes('>CLID<'));
  assert.ok(fr.includes('Contrôle') && fr.includes('Autonomie') && fr.includes('Nocturne'));
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(fr), 'aucune ressource externe');
  assert.ok(!fr.includes('<image') && !fr.includes('@import') && !fr.includes('<style'));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(fr), 'tous les & sont échappés');
  const en = renderCard(stats, profile, { lang: 'en', theme: 'dark' });
  assert.ok(en.includes('The Sniper') && en.includes(THEMES.dark.card));
  assert.ok(en.includes('$0'));
});

test('échappement des caractères XML', () => {
  assert.equal(esc(`Tom & Jerry <b> "x" 'y'`), 'Tom &amp; Jerry &lt;b&gt; &quot;x&quot; &#39;y&#39;');
  const svg = renderCard(stats, { ...profile, code: 'A&B<C>' }, { lang: 'en' });
  assert.ok(svg.includes('>A&amp;B&lt;C&gt;<'));
});

test('positions des curseurs', () => {
  const svg = renderCard(stats, { code: 'ALIN', axes: { A: 0, V: 100, P: 50, N: 35 } }, { lang: 'en' });
  assert.ok(svg.includes('<circle cx="200"'));   // score 0 → début de piste
  assert.ok(svg.includes('<circle cx="540"'));   // score 100 → fin de piste
  assert.ok(svg.includes('<circle cx="370"'));   // score 50 → milieu
});
