// tests/codex-i18n.test.js — textes des bilans Codex (spec CXTI § 3.4 ; spec CCTI Claude+Codex § 5).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, CODEX_LANGS, t, setTool } from '../src/i18n.js';

afterEach(() => setTool('claude'));
const all = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : []);

// Un bilan Codex ne parle ni de Claude ni d'Anthropic ; l'accueil (ui), commun, cite les deux outils,
// et le sous-titre de marque contient « Claude and Codex ».
test('bilan Codex : ni Claude, ni Anthropic, ni modèle Claude', () => {
  for (const lang of ['fr', 'en']) {
    const { ui, card: { subtitle, ...card }, ...report } = CODEX_LANGS[lang];
    for (const s of all({ ...report, card })) assert.ok(!/claude|anthropic|opus|sonnet|fable|haiku/i.test(s), `${lang} : ${s}`);
    assert.ok(!/Claude/.test(ui.shareIntro), `${lang} shareIntro`);
  }
});

test('sous-titre de carte par outil', () => {
  assert.equal(t('fr', 'card.subtitle'), 'Claude and Codex Type Indicator · Claude Code');
  setTool('codex');
  assert.equal(t('fr', 'card.subtitle'), 'Claude and Codex Type Indicator · Codex');
  assert.equal(t('en', 'card.subtitle'), 'Claude and Codex Type Indicator · Codex');
});

test('setTool choisit le jeu de textes sans modifier les textes Claude', () => {
  setTool('codex');
  assert.equal(t('fr', 'types.ALID.name'), 'Le Joueur de YOLO');
  assert.ok(t('fr', 'observations.apologies').startsWith('Codex'));
  assert.ok(t('fr', 'labels.compressedSkipped').includes('zstd -d'));
  setTool('claude');
  assert.ok(t('fr', 'observations.apologies').startsWith('Claude'));
  assert.equal(LANGS.fr.ui.title, 'CCTI');
});

test('accueil commun aux deux outils', () => {
  for (const tool of ['claude', 'codex']) {
    setTool(tool);
    for (const lang of ['fr', 'en']) {
      assert.equal(t(lang, 'ui.title'), 'CCTI');
      const drop = t(lang, 'ui.dropHint');
      assert.ok(drop.includes('~/.claude/projects') && drop.includes('~/.codex/sessions'), `${tool} ${lang}`);
      const foot = t(lang, 'ui.footer');
      assert.ok(foot.includes('Anthropic') && foot.includes('OpenAI') && foot.includes('Myers-Briggs'), `${tool} ${lang}`);
      assert.ok(t(lang, 'ui.noFiles').includes('zstd -d'));
      assert.ok(t(lang, 'ui.shareFooter').endsWith('https://sandjab.github.io/ccti'));
      assert.ok(t(lang, 'ui.toolCodex', { n: '3' }).includes('3'));
    }
  }
});
