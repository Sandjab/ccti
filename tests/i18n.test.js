// tests/i18n.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, t, fmtN, fmtDay, fmtMinutes, detectLang } from '../src/i18n.js';
import { OBSERVATIONS } from '../src/profile.js';

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

test('parité des clés FR/EN', () => {
  assert.deepEqual(keys(LANGS.fr).sort(), keys(LANGS.en).sort());
});

test('16 types et 24 observations dans chaque langue', () => {
  const codes = [];
  for (const A of 'CA') for (const V of 'VL') for (const P of 'PI') for (const N of 'DN') codes.push(A + V + P + N);
  for (const lang of ['fr', 'en']) {
    for (const c of codes) {
      assert.equal(typeof LANGS[lang].types[c].name, 'string', `${lang} ${c} name`);
      assert.ok(LANGS[lang].types[c].text.length > 80, `${lang} ${c} text`);
    }
    for (const o of OBSERVATIONS) assert.ok(o.id === 'noplan' || LANGS[lang].observations[o.id].includes('{n}'), `${lang} ${o.id}`); // noplan n'a pas de chiffre (spec § 5.2)
    assert.equal(Object.keys(LANGS[lang].observations).length, 24);
  }
});

test('t() avec variables et clé manquante', () => {
  assert.equal(t('fr', 'types.CLID.name'), "Le Tireur d'élite");
  assert.equal(t('en', 'types.CLID.name'), 'The Sniper');
  assert.equal(t('fr', 'observations.caps', { n: '3' }), '3 messages en majuscules. Claude ne lit pas plus fort, mais il a bien noté.');
  assert.equal(t('fr', 'nope.nothing'), 'nope.nothing');
  assert.equal(t('xx', 'types.CLID.name'), 'The Sniper'); // langue inconnue → EN
});

test('formats', () => {
  assert.equal(fmtN('fr', 'int', 1234), '1 234'.replace(' ', ' '));
  assert.equal(fmtN('en', 'int', 1234), '1,234');
  assert.equal(fmtN('fr', 'pct', 0.154), '15 %'.replace(' ', ' '));
  assert.equal(fmtN('en', 'pct', 0.154), '15%');
  assert.equal(fmtN('en', 'usd', 1234.4), '$1,234');
  assert.equal(fmtN('fr', 'usd', 1234.4), '1 234 $'.replace(/ /g, ' '));
  assert.equal(fmtN('fr', 'hours', 4.2), '4 h 12');
  assert.equal(fmtN('en', 'hours', 4.2), '4h 12m');
  assert.equal(fmtN('en', 'sec', 12.4), '12 s');
  assert.equal(fmtMinutes('fr', 183), '3 h 03');
  assert.equal(fmtDay('en', '2026-10-05'), 'Oct 5, 2026');
  assert.equal(fmtDay('fr', '2026-10-05'), '5 oct. 2026');
});

test('detectLang', () => {
  assert.equal(detectLang({ language: 'fr-FR' }), 'fr');
  assert.equal(detectLang({ language: 'en-US' }), 'en');
  assert.equal(detectLang({}), 'en');          // pas de navigator.language → EN
  assert.equal(detectLang({ language: 'de-DE' }), 'en');
});
