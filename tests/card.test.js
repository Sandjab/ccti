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

test('positions des curseurs : le seuil de chaque axe est au centre de la piste', () => {
  // Seuils : A 50, V 50, P 33, N 35. Un point du côté droit doit toujours donner la lettre de droite.
  const svg = renderCard(stats, { code: 'ALPN', axes: { A: 0, V: 100, P: 50, N: 36 } }, { lang: 'en' });
  const cx = [...svg.matchAll(/<circle cx="(\d+)"/g)].map((m) => +m[1]);
  assert.equal(cx[0], 200);   // score 0 → début de piste
  assert.equal(cx[1], 540);   // score 100 → fin de piste
  assert.equal(cx[2], 413);   // P 50, seuil 33 → 370 + 170 × 17/67
  assert.equal(cx[3], 373);   // N 36, seuil 35 → juste à droite du centre (370), comme la lettre N
  const atThreshold = renderCard(stats, { code: 'ALPN', axes: { A: 50, V: 50, P: 33, N: 35 } }, { lang: 'en' });
  assert.deepEqual([...atThreshold.matchAll(/<circle cx="(\d+)"/g)].map((m) => +m[1]), [370, 370, 370, 370]);
  const below = renderCard(stats, { code: 'ALID', axes: { A: 0, V: 0, P: 32, N: 34 } }, { lang: 'en' });
  const [, , p32, n34] = [...below.matchAll(/<circle cx="(\d+)"/g)].map((m) => +m[1]);
  assert.ok(p32 < 370 && n34 < 370, 'sous le seuil, le point reste à gauche du centre');
});

test('chaque jauge affiche sa valeur de seuil, deux graduations et un repère central', () => {
  const svg = renderCard(stats, profile, { lang: 'en' });
  const shown = [...svg.matchAll(/class="threshold"[^>]*>(\d+)</g)].map((m) => +m[1]);
  assert.deepEqual(shown, [50, 50, 33, 35], 'le seuil de chaque axe est écrit sous le repère central');
  // échelle non linéaire : pas de graduations régulières qui feraient croire le contraire
  const ticks = [...svg.matchAll(/<line x1="(\d+(?:\.\d+)?)" y1="(\d+)" x2="\1" y2="(\d+)" stroke="[^"]+" stroke-width="1"\/>/g)];
  assert.equal(ticks.length, 4 * 2, 'deux extrémités par jauge');
});

test('info-bulle par axe : calcul, seuil et score, dans la langue de la carte', () => {
  const fr = renderCard(stats, profile, { lang: 'fr' });
  const titles = [...fr.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  assert.equal(titles.length, 4);
  assert.match(titles[3], /21\u00a0h et 6\u00a0h/);
  assert.match(titles[3], /Nocturne \(N\) à partir de 35\u00a0%/);
  assert.match(titles[3], /Votre score\u00a0: 20/);
  assert.match(titles[1], /200 caractères/);   // seuil V 50 = médiane de 200 caractères
  assert.match(titles[2], /33\u00a0%/);
  const en = renderCard(stats, profile, { lang: 'en' });
  assert.match(en, /<title>[^<]*9 pm and 6 am[^<]*Nocturnal \(N\) from 35%[^<]*<\/title>/);
});
