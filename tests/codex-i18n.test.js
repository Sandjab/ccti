// tests/codex-i18n.test.js — textes CXTI (spec CXTI § 3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, t } from '../src/i18n.js';
import { applyCodexTexts } from '../codex/i18n.js';

const fr = LANGS.fr, en = LANGS.en; // références aux dictionnaires CCTI avant la surcouche
applyCodexTexts();
const all = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : []);

// La page Codex ne doit jamais parler de Claude ni renvoyer vers la page CCTI.
test('aucun texte CXTI ne mentionne Claude ni ~/.claude', () => {
  for (const lang of ['fr', 'en']) for (const s of all(LANGS[lang])) assert.ok(!/claude/i.test(s), `${lang} : ${s}`);
});

test('toute URL partagée mène à la page Codex', () => {
  for (const lang of ['fr', 'en']) for (const s of all(LANGS[lang])) {
    for (const m of s.matchAll(/github\.io\/ccti(\S*)/g)) assert.ok(m[1].startsWith('/codex'), `${lang} : ${s}`);
  }
});

test('nom, emplacement du dossier, mention OpenAI, ligne des fichiers compressés', () => {
  for (const lang of ['fr', 'en']) {
    assert.equal(t(lang, 'ui.title'), 'CXTI');
    assert.equal(t(lang, 'card.subtitle'), 'Codex Type Indicator');
    assert.ok(t(lang, 'ui.dropHint').includes('~/.codex/sessions'));
    assert.ok(t(lang, 'ui.footer').includes('OpenAI'));
    assert.ok(t(lang, 'ui.noFiles').includes('zstd -d'));
    assert.ok(t(lang, 'labels.compressedSkipped').includes('zstd -d'));
  }
  assert.equal(t('fr', 'types.ALID.name'), 'Le Joueur de YOLO');
  assert.ok(t('fr', 'observations.apologies').startsWith('Codex'));
});

test('les dictionnaires CCTI d\'origine ne sont pas modifiés', () => {
  assert.equal(fr.ui.title, 'CCTI');
  assert.ok(en.card.agreed.includes('Claude'));
});
