# CCTI Claude + Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule page CCTI qui reconnaît les sessions Claude Code et Codex déposées, et affiche un bilan par outil avec un sélecteur.

**Architecture:** `src/sources.js` marque chaque fichier `tool: 'claude' | 'codex'`. Le worker garde un analyseur par outil et renvoie `{ reports: { claude?, codex? } }`. `src/main.js` (redevenu point d'entrée unique, sans « saveur ») affiche le bilan de l'outil choisi ; `t()` lit le jeu de textes de cet outil (`setTool`). La page `/codex/` et `cxti.html` disparaissent ; `codex/` ne garde que le code propre à Codex.

**Tech Stack:** JavaScript ES modules sans dépendance, `node --test`, Playwright (Chromium), build maison `scripts/build.mjs`, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-ccti-claude-codex-design.md` (et, pour le parseur Codex, `docs/superpowers/specs/2026-10-18-cxti-design.md`).

## Global Constraints

- Aucune dépendance ajoutée ; aucune requête réseau depuis la page.
- Nom : `CCTI` ; sous-titre de carte `Claude and Codex Type Indicator · Claude Code` ou `Claude and Codex Type Indicator · Codex`.
- Mention d'indépendance : Anthropic, OpenAI, The Myers-Briggs Company.
- Jamais de bilan fusionné : un bilan par outil.
- Exports Claude inchangés : `ccti-<CODE>.png`, `ccti-<CODE>-full.png`, `ccti-stats.json`. Exports Codex : `ccti-codex-<CODE>.png`, `ccti-codex-<CODE>-full.png`, `ccti-codex-stats.json`.
- `/codex/` (page) et `codex/cxti.html` n'existent plus ; les modules `codex/*.js` restent servis (importés par la page).
- Un bilan Codex (diagnostic, sections, textes de carte hors sous-titre de marque) ne contient ni « Claude » ni « Anthropic ».
- Tests existants : ils passent ; seuls changent ceux dont le comportement change (accroche `h1`, tests CXTI remplacés).
- Style : commentaires en français, en-tête `// chemin — rôle (spec).` ; commits en anglais terminés par `Claude-Session: https://claude.ai/code/session_0192DpdSD1TXL3ZbPURJoh8q`.

## Review Focus

1. Déposer `~/.codex` seul (avec `history.jsonl`, `session_index.jsonl`) : aucun onglet Claude fantôme → test dans la tâche 1.
2. Sessions Claude + un dossier Codex ne contenant que des `.jsonl.zst` : bilan Claude seul, pas d'onglet Codex à 0 session → test e2e dans la tâche 3.
3. « Ajouter un dossier » avec un dossier déjà analysé : aucune session comptée deux fois → test e2e dans la tâche 3.
4. Changer de langue sur l'onglet Codex : les textes restent ceux de Codex → test e2e dans la tâche 3.
5. « Analyser un autre dossier » après un bilan Codex, puis un dépôt Claude : textes Claude de nouveau → test e2e dans la tâche 3.

**Ruling déjà pris (écart à la spec § 2) :** la spec prévoyait que `src/files.js` ignore les noms `rollout-*`. Cela ne suffit pas : `~/.codex/history.jsonl` serait lu comme une session Claude. Règle retenue, dans `src/sources.js` : **dès que des fichiers Codex sont présents, un fichier n'est Claude que s'il est sous un dossier `projects/`**. Sans fichier Codex, le tri Claude est inchangé. `src/files.js` n'est pas modifié.

---

### Task 1: Reconnaissance de la source

**Files:**
- Create: `src/sources.js`
- Test: `tests/sources.test.js`

**Interfaces:**
- Consumes: `classify` de `src/files.js` (items `{ file, slug, kind, sessionId }`), `classify` de `codex/files.js` (items `{ file, sessionId, skip? }`).
- Produces: `accept(name) → boolean` ; `classify(entries: [{ file, rel }]) → [{ ...item, tool: 'claude' | 'codex' }]`, items Claude d'abord.

- [ ] **Step 1: Write the failing test**

```js
// tests/sources.test.js — chaque fichier déposé est rattaché à son outil (spec CCTI Claude+Codex § 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, accept } from '../src/sources.js';

const F = (rel) => ({ file: { name: rel.split('/').pop() }, rel });
const tools = (out) => out.map((o) => `${o.tool}:${o.sessionId}`);

test('Claude seul : tri inchangé', () => {
  const out = classify([F('projects/-Users-x-Dev-a/s1.jsonl'), F('projects/-Users-x-Dev-a/s1/subagents/agent-1.jsonl')]);
  assert.deepEqual(tools(out), ['claude:s1', 'claude:s1']);
});

test('.claude et .codex déposés ensemble : les deux outils', () => {
  const out = classify([
    F('.claude/projects/-Users-x-Dev-a/s1.jsonl'),
    F('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
    F('.codex/history.jsonl'),
  ]);
  assert.deepEqual(tools(out), ['claude:s1', 'codex:rollout-2026-10-05T22-00-00-a1']);
});

// ~/.codex contient d'autres .jsonl (historique, index) : ils ne doivent pas créer un bilan Claude fantôme.
test('~/.codex seul : aucun fichier Claude', () => {
  const out = classify([
    F('.codex/history.jsonl'), F('.codex/session_index.jsonl'),
    F('.codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl'),
  ]);
  assert.deepEqual(tools(out), ['codex:rollout-2026-10-05T22-00-00-a1']);
});

test('un dossier de jour Codex glissé seul n\'est pas un projet Claude', () => {
  const out = classify([F('05/rollout-2026-10-05T22-00-00-a1.jsonl'), F('05/rollout-2026-10-05T23-00-00-a2.jsonl')]);
  assert.ok(out.every((o) => o.tool === 'codex'));
  assert.equal(out.length, 2);
});

test('fichiers compressés seuls : items Codex marqués skip', () => {
  const out = classify([F('sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst')]);
  assert.deepEqual(out.map((o) => [o.tool, o.skip]), [['codex', true]]);
});

test('accept : jsonl et jsonl.zst', () => {
  assert.ok(accept('a.jsonl')); assert.ok(accept('rollout-a.jsonl.zst')); assert.ok(!accept('notes.md'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sources.test.js`
Expected: FAIL, module `src/sources.js` introuvable.

- [ ] **Step 3: Implement `src/sources.js`**

```js
// src/sources.js — rattache chaque fichier déposé à son outil, Claude Code ou Codex
// (spec CCTI Claude+Codex § 2). Les deux tris existants font le travail ; ce module les réunit.
import { classify as classifyClaude } from './files.js';
import { classify as classifyCodex } from '../codex/files.js';

export const accept = (name) => name.endsWith('.jsonl') || name.endsWith('.jsonl.zst');

export function classify(entries) {
  const codex = classifyCodex(entries).map((it) => ({ ...it, tool: 'codex' }));
  let claude = classifyClaude(entries);
  // Avec des fichiers Codex dans le dépôt, un fichier n'est Claude que sous projects/ :
  // ~/.codex/history.jsonl ou un dossier de jour Codex ne doivent pas passer pour des sessions Claude.
  if (codex.length) {
    const inProjects = new Set(entries.filter((e) => String(e.rel).split(/[\\/]/).includes('projects')).map((e) => e.file));
    claude = claude.filter((it) => inProjects.has(it.file));
  }
  return [...claude.map((it) => ({ ...it, tool: 'claude' })), ...codex];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sources.js tests/sources.test.js
git commit -m "feat: each dropped file is tied to Claude Code or Codex

Claude-Session: https://claude.ai/code/session_0192DpdSD1TXL3ZbPURJoh8q"
```

---

### Task 2: Textes par outil, accueil commun, fin de la page /codex/

**Files:**
- Modify: `codex/i18n.js` (réécrit : fonction pure), `src/i18n.js`, `src/i18n/fr.js`, `src/i18n/en.js`, `tests/codex-i18n.test.js` (réécrit), `tests/codex-demo.test.js`, `tests/e2e/ccti.spec.js:14`, `tests/e2e/dist.spec.js` (cas cxti retiré), `scripts/build.mjs` (cible cxti retirée), `.github/workflows/ci.yml`
- Delete: `codex/index.html`, `codex/main.js`, `codex/worker.js`, `codex/worker-factory.js`, `tests/e2e/cxti.spec.js`

**Interfaces:**
- Produces: `setTool('claude' | 'codex')` et `CODEX_LANGS` exportés par `src/i18n.js` ; `codexTexts(dict, lang) → dict` exporté par `codex/i18n.js` ; clés communes `ui.addFolder`, `ui.toolClaude` (`{n}`), `ui.toolCodex` (`{n}`).

- [ ] **Step 1: Write the failing tests**

Remplacer tout `tests/codex-i18n.test.js` par :

```js
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
```

Dans `tests/codex-demo.test.js` :
- remplacer `import { applyCodexTexts } from '../codex/i18n.js';` par `import { setTool } from '../src/i18n.js';`
- remplacer `applyCodexTexts();` par `setTool('codex');`
- remplacer `assert.ok(svg.includes('>CXTI</text>'));` par `assert.ok(svg.includes('>CCTI</text>')); assert.ok(svg.includes('· Codex'));`

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/codex-i18n.test.js tests/codex-demo.test.js`
Expected: FAIL (`CODEX_LANGS`/`setTool` n'existent pas).

- [ ] **Step 3: Rewrite `codex/i18n.js`**

```js
// codex/i18n.js — textes des bilans Codex (spec CXTI § 3.4 ; spec CCTI Claude+Codex § 5) : les textes
// Claude où Claude devient Codex, puis quelques clés réécrites. L'accueil (ui) est commun aux deux outils
// et n'est pas transformé, sauf l'intro du texte de partage. Fonction pure : rien n'est modifié en place.
function swap(v) {
  if (typeof v === 'string') return v.replace(/Claude Code/g, 'Codex').replace(/Claude/g, 'Codex');
  if (Array.isArray(v)) return v.map(swap);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
  return v;
}
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
  return out;
}

const OVERRIDES = {
  fr: {
    ui: { shareIntro: 'Analyse à la MBTI de mes {sessions} sessions avec Codex : 4 axes mesurés, 16 types possibles. Le mien :' },
    card: { subtitle: 'Claude and Codex Type Indicator · Codex' },
    axesHelp: {
      A: "Contrôle ou Autonomie. 70 % : la part de vos messages envoyés avec un réglage qui laisse Codex agir sans demander (approbation « never », avec ou sans danger-full-access) ; le réglage par défaut (on-request) compte en contrôle. 30 % : l'absence de friction, c'est-à-dire peu d'interruptions et de refus d'outils par message. Autonomie (A) à partir de {t}, sinon Contrôle (C). Votre score : {score}.",
    },
    labels: {
      questions: 'Questions posées par Codex',
      billDisclaimer: "Estimation au tarif API public d'OpenAI (contexte court), cache compris. Votre abonnement ne facture pas ainsi.",
      wasteNote: "Un gros contexte n'est pas du gaspillage en soi : il est repayé à chaque échange. /compact ou une nouvelle session allègent la note.",
      compressedSkipped: 'Sessions compressées ignorées (zstd -d pour les inclure)',
    },
    observations: {
      cost: 'Équivalent API : {n}. Votre abonnement est la meilleure affaire de votre vie, et OpenAI le sait.',
      models: "{n} modèles traversés. GPT-5, Codex, mini… Vous n'êtes resté fidèle à personne.",
    },
  },
  en: {
    ui: { shareIntro: 'An MBTI-style analysis of my {sessions} Codex sessions: 4 measured axes, 16 possible types. Mine:' },
    card: { subtitle: 'Claude and Codex Type Indicator · Codex' },
    axesHelp: {
      A: 'Control or Autonomy. 70%: the share of your messages sent with a setting that lets Codex act without asking (approval "never", with or without danger-full-access); the default setting (on-request) counts as control. 30%: lack of friction, meaning few interruptions and tool denials per message. Autonomy (A) from {t}, otherwise Control (C). Your score: {score}.',
    },
    labels: {
      questions: 'Questions Codex asked',
      billDisclaimer: "Estimate at OpenAI's public API prices (short context), cache included. Your subscription does not bill this way.",
      wasteNote: 'A large context is not waste in itself: it is paid again on every exchange. /compact or a fresh session lighten the bill.',
      compressedSkipped: 'Compressed sessions skipped (zstd -d to include them)',
    },
    observations: {
      cost: 'API equivalent: {n}. Your subscription is the best deal of your life, and OpenAI knows it.',
      models: '{n} models over the period. GPT-5, Codex, mini… You stayed loyal to no one.',
    },
  },
};

export function codexTexts(dict, lang) {
  const { ui, ...report } = dict;
  return merge({ ui, ...swap(report) }, OVERRIDES[lang] || {});
}
```

- [ ] **Step 4: `src/i18n.js`**

Remplacer le début (imports et `LANGS`) et `t` :

```js
// src/i18n.js — accès aux textes et formats (spec § 7.4). Deux jeux de textes : Claude Code et Codex,
// choisis par l'outil du bilan affiché (spec CCTI Claude+Codex § 5).
import fr from './i18n/fr.js';
import en from './i18n/en.js';
import { codexTexts } from '../codex/i18n.js';

export const LANGS = { fr, en };
export const CODEX_LANGS = { fr: codexTexts(fr, 'fr'), en: codexTexts(en, 'en') };
let tool = 'claude';
export function setTool(x) { tool = x === 'codex' ? 'codex' : 'claude'; }
```

et dans `t` : `const dict = LANGS[lang] || en;` → 
```js
  const set = tool === 'codex' ? CODEX_LANGS : LANGS;
  const dict = set[lang] || set.en;
```

- [ ] **Step 5: Textes communs dans `src/i18n/fr.js` et `src/i18n/en.js`**

`fr.js`, remplacer les valeurs (clé par clé) :
- `tagline: 'Votre binôme Claude Code ou Codex en 4 lettres : un test de personnalité à 16 types.',`
- `dropHint: 'Glissez ici le dossier ~/.claude/projects ou ~/.codex/sessions (ou les deux)',`
- `whereMac: 'macOS : ~/.claude/projects pour Claude Code, ~/.codex/sessions pour Codex. Dans le sélecteur, Cmd+Shift+. affiche les dossiers cachés, ou Cmd+Shift+G puis collez le chemin.',`
- `whereWin: "Windows : %USERPROFILE%\\.claude\\projects ou %USERPROFILE%\\.codex\\sessions, à coller dans la barre d'adresse du sélecteur.",`
- `whereLinux: 'Linux : ~/.claude/projects ou ~/.codex/sessions (Ctrl+H affiche les dossiers cachés).',`
- `noFiles: 'Aucune session lisible. Dossiers attendus : ~/.claude/projects (un sous-dossier par projet, fichiers .jsonl) ou ~/.codex/sessions (fichiers rollout-*.jsonl ; les .jsonl.zst se décompressent avec zstd -d).',`
- `shareFooter: 'Test de personnalité à 16 types pour Claude Code et Codex, calculé dans le navigateur, rien ne quitte la machine : https://sandjab.github.io/ccti',`
- `footer: "CCTI ne stocke rien et n'envoie rien. Les heures sont celles de votre fuseau ({tz}). Projet indépendant, sans lien avec Anthropic, OpenAI ni The Myers-Briggs Company.",`
- dans `card` : `subtitle: 'Claude and Codex Type Indicator · Claude Code',`
- ajouter dans `ui`, après `again` : `addFolder: 'Ajouter un dossier', toolClaude: 'Claude Code · {n} sessions', toolCodex: 'Codex · {n} sessions',`

`en.js`, mêmes clés :
- `tagline: 'You and Claude Code or Codex in four letters: a 16-type personality test.',`
- `dropHint: 'Drop your ~/.claude/projects or ~/.codex/sessions folder here (or both)',`
- `whereMac: 'macOS: ~/.claude/projects for Claude Code, ~/.codex/sessions for Codex. In the picker, Cmd+Shift+. shows hidden folders, or Cmd+Shift+G and paste the path.',`
- `whereWin: "Windows: %USERPROFILE%\\.claude\\projects or %USERPROFILE%\\.codex\\sessions, paste it in the picker's address bar.",`
- `whereLinux: 'Linux: ~/.claude/projects or ~/.codex/sessions (Ctrl+H shows hidden folders).',`
- `noFiles: 'No readable sessions. Expected folders: ~/.claude/projects (one subfolder per project, .jsonl files) or ~/.codex/sessions (rollout-*.jsonl files; decompress .jsonl.zst files with zstd -d).',`
- `shareFooter: '16-type personality test for Claude Code and Codex, computed in the browser, nothing leaves your machine: https://sandjab.github.io/ccti',`
- `footer: 'CCTI stores nothing and sends nothing. Hours are in your time zone ({tz}). Independent project, affiliated with neither Anthropic, OpenAI nor The Myers-Briggs Company.',`
- `card.subtitle: 'Claude and Codex Type Indicator · Claude Code',`
- `addFolder: 'Add a folder', toolClaude: 'Claude Code · {n} sessions', toolCodex: 'Codex · {n} sessions',`

- [ ] **Step 6: Retirer la page /codex/**

```bash
git rm -q codex/index.html codex/main.js codex/worker.js codex/worker-factory.js tests/e2e/cxti.spec.js
```

`scripts/build.mjs` : supprimer l'entrée `{ html: 'codex/index.html', … }` de `TARGETS`, et dans `SHARED` insérer `'codex/i18n.js'` avant `'src/i18n.js'` (dépendance de `src/i18n.js`). En-tête ligne 1 : `→ dist/ccti.html (spec § 7.3).`

`tests/e2e/dist.spec.js` : supprimer le test `dist/cxti.html en file://` (remplacé à la tâche 3).

`tests/e2e/ccti.spec.js:14` : texte attendu → `'Votre binôme Claude Code ou Codex en 4 lettres : un test de personnalité à 16 types.'`

`.github/workflows/ci.yml` : `path:` de l'artefact redevient `dist/ccti.html` (une ligne) ; dans « Assemble site », remplacer les deux lignes CXTI par
```yaml
          mkdir -p _site/codex && cp codex/*.js _site/codex/
```
(la page importe `codex/*.js` ; aucun `index.html` n'y est copié, donc `/codex/` répond 404).

- [ ] **Step 7: Run tests**

Run: `npm test && npm run build && npm run e2e`
Expected: PASS ; le build n'écrit plus que `dist/ccti.html`.

- [ ] **Step 8: Commit**

```bash
git add -A codex src tests scripts .github
git commit -m "feat: texts per tool, shared home page, no more /codex/ page

Claude-Session: https://claude.ai/code/session_0192DpdSD1TXL3ZbPURJoh8q"
```

---

### Task 3: Un analyseur par outil, sélecteur, « Ajouter un dossier »

**Files:**
- Modify: `src/worker-core.js`, `src/worker.js`, `src/render.js` (retrait de `setAssetBase`), `index.html`, `src/styles.css`, `scripts/build.mjs`, `tests/e2e/dist.spec.js`
- Move: `src/app.js` → `src/main.js` (l'actuel `src/main.js` est supprimé)
- Test: `tests/worker-core.test.js` (nouveau), `tests/e2e/sources.spec.js` (nouveau)

**Interfaces:**
- Consumes: `classify`/`accept` (tâche 1) ; `setTool` (tâche 2) ; `Analyzer`, `CodexAnalyzer` ; démos `src/demo.js` et `codex/demo.js`.
- Produces: `runWorker(tools)` avec `tools = { claude: { make, info }, codex: { make, info } }` ; message de résultat `{ type: 'result', reports: { claude?, codex? }, bytes }` ; ids DOM `#tools` (boutons `aria-pressed`) et `#add`.

- [ ] **Step 1: Write the failing unit test**

```js
// tests/worker-core.test.js — un dépôt mixte donne un bilan par outil, jamais un bilan fusionné
// (spec CCTI Claude+Codex § 3).
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Analyzer, projectFromSlug } from '../src/analyzer.js';
import { CodexAnalyzer } from '../codex/analyzer.js';

const messages = [];
globalThis.self = { postMessage: (m) => messages.push(m) };
const { runWorker } = await import('../src/worker-core.js');
runWorker({
  claude: { make: () => new Analyzer(), info: (it) => ({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId }) },
  codex: { make: () => new CodexAnalyzer(), info: (it) => ({ sessionId: it.sessionId }) },
});
const file = (p) => new File([readFileSync(p)], p.split('/').pop());
const CLAUDE = 'tests/fixtures/projects/-Users-test-Dev-beta/b5555555-0000-0000-0000-000000000005.jsonl';
const CODEX = 'tests/fixtures-codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl';

async function run(files) {
  messages.length = 0;
  await self.onmessage({ data: { type: 'start', files } });
  return messages.at(-1);
}

test('dépôt mixte : deux bilans séparés', async () => {
  const r = await run([
    { tool: 'claude', file: file(CLAUDE), slug: '-Users-test-Dev-beta', kind: 'main', sessionId: 'b5' },
    { tool: 'codex', file: file(CODEX), sessionId: 'a1' },
  ]);
  assert.equal(r.type, 'result');
  assert.deepEqual(Object.keys(r.reports), ['claude', 'codex']);
  assert.equal(r.reports.codex.volume.sessions, 1);
  assert.equal(r.reports.codex.volume.humanMessages, 2);
  assert.ok(r.reports.claude.bill.byModel['gpt-5.2-codex'] === undefined); // aucun token Codex côté Claude
});

test('un seul outil : un seul bilan', async () => {
  const r = await run([{ tool: 'codex', file: file(CODEX), sessionId: 'a1' }]);
  assert.deepEqual(Object.keys(r.reports), ['codex']);
});

test('fichier compressé : compté côté Codex, non lu', async () => {
  const r = await run([{ tool: 'codex', file: new File(['x'], 'r.jsonl.zst'), sessionId: 'f', skip: true }]);
  assert.equal(r.reports.codex.volume.compressedSkipped, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/worker-core.test.js`
Expected: FAIL (`runWorker` attend encore `(makeAnalyzer, fileInfo)` ; `reports` absent).

- [ ] **Step 3: `src/worker-core.js` et `src/worker.js`**

Dans `src/worker-core.js`, remplacer `export function runWorker(makeAnalyzer, fileInfo) { … }` par :

```js
// tools : { claude: { make, info }, codex: { make, info } } — un analyseur par outil présent dans le dépôt,
// créé au premier fichier de cet outil ; le résultat garde un bilan par outil (spec CCTI Claude+Codex § 3).
export function runWorker(tools) {
  self.onmessage = async (e) => {
    if (!e.data || e.data.type !== 'start') return;
    const items = e.data.files;
    const analyzers = new Map();
    const of = (tool) => { if (!analyzers.has(tool)) analyzers.set(tool, tools[tool].make()); return analyzers.get(tool); };
    let bytes = 0, done = 0, last = 0;
    const progress = (force) => {
      const now = Date.now();
      if (!force && now - last < 50) return;
      last = now;
      let sessions = 0;
      for (const a of analyzers.values()) sessions += a.s.sessions;
      self.postMessage({ type: 'progress', done, total: items.length, bytes, sessions });
    };
    for (const it of items) {
      const a = of(it.tool);
      if (it.skip) { a.skipFile(it); done++; continue; } // fichier reconnu mais illisible ici (.zst)
      a.beginFile(tools[it.tool].info(it));
      try {
        await readLines(it.file, (line) => a.feedLine(line), (n) => { bytes += n; progress(false); });
      } catch {
        a.s.corruptLines++;            // fichier illisible : on passe au suivant
      }
      a.endFile();
      done++;
      progress(false);
    }
    progress(true);
    const reports = {};
    for (const [tool, a] of analyzers) reports[tool] = a.result();
    self.postMessage({ type: 'result', reports, bytes });
  };
}
```

Remplacer tout `src/worker.js` par :

```js
// src/worker.js — Web Worker : un analyseur par outil, Claude Code ou Codex (spec § 7.1 ; spec CCTI Claude+Codex § 3).
import { Analyzer, projectFromSlug } from './analyzer.js';
import { CodexAnalyzer } from '../codex/analyzer.js';
import { runWorker } from './worker-core.js';

runWorker({
  claude: { make: () => new Analyzer(), info: (it) => ({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId }) },
  codex: { make: () => new CodexAnalyzer(), info: (it) => ({ sessionId: it.sessionId }) },
});
```

Run: `node --test tests/worker-core.test.js`
Expected: PASS (3 tests).

- [ ] **Step 4: Write the failing e2e test `tests/e2e/sources.spec.js`**

```js
// tests/e2e/sources.spec.js — une page, deux outils (spec CCTI Claude+Codex § 8) : détection,
// sélecteur, « Ajouter un dossier », textes et exports par outil, aucune requête externe.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const read = (root, prefix) => readdirSync(root, { recursive: true })
  .filter((f) => statSync(path.join(root, f)).isFile())
  .map((f) => ({ rel: prefix + f.split(path.sep).join('/'), text: readFileSync(path.join(root, f), 'utf8') }));
const CLAUDE = read('tests/fixtures/projects', '.claude/projects/');
const CODEX = read('tests/fixtures-codex', '.codex/');
const ZST_ONLY = read('tests/fixtures-codex-zst', '.codex/');

// Faux showDirectoryPicker : l'arborescence est construite en mémoire à partir de { rel, text }.
// Chaque appel prend le lot suivant (« Ajouter un dossier » rouvre le sélecteur).
async function stubPicker(page, ...batches) {
  await page.addInitScript((batches) => {
    let call = 0;
    window.showDirectoryPicker = async () => {
      const files = batches[Math.min(call++, batches.length - 1)];
      const tree = { kind: 'directory', name: 'home', children: new Map() };
      for (const { rel, text } of files) {
        const parts = rel.split('/'); let node = tree;
        for (const p of parts.slice(0, -1)) {
          if (!node.children.has(p)) node.children.set(p, { kind: 'directory', name: p, children: new Map() });
          node = node.children.get(p);
        }
        node.children.set(parts.at(-1), { kind: 'file', name: parts.at(-1), text });
      }
      let t = 0;
      const wrap = (n) => n.kind === 'file'
        ? { kind: 'file', name: n.name, getFile: async () => new File([n.text], n.name, { lastModified: 1_700_000_000_000 + (t++) }) }
        : { kind: 'directory', name: n.name, async *entries() { for (const [k, c] of n.children) yield [k, wrap(c)]; } };
      return wrap(tree);
    };
  }, batches);
}
const external = (page) => {
  const urls = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== '127.0.0.1:8765' && u.protocol !== 'blob:' && u.protocol !== 'data:') urls.push(r.url()); });
  return urls;
};

test('Codex seul : bilan Codex, pas de sélecteur, exports ccti-codex', async ({ page }) => {
  const urls = external(page);
  await page.goto('/');
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await expect(page.locator('#card svg')).toContainText('Claude and Codex Type Indicator · Codex');
  await expect(page.locator('#diagnosis')).not.toContainText('Claude');
  await expect(page.locator('#sections')).not.toContainText('Claude');
  await expect(page.locator('#sections')).toContainText('Sessions compressées ignorées');
  await expect(page.locator('#sections')).not.toContainText('Bloqués par le mode auto');
  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#json')]);
  expect(json.suggestedFilename()).toBe('ccti-codex-stats.json');
  expect(urls).toEqual([]);
});

test('dépôt mixte : sélecteur, bascule, langue, exports par outil', async ({ page }) => {
  await stubPicker(page, [...CLAUDE, ...CODEX]);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  const buttons = page.locator('#tools button');
  await expect(buttons).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#card svg')).toContainText('CLID');
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await expect(page.locator('#card svg')).toContainText('· Codex');
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#png')]);
  expect(png.suggestedFilename()).toBe('ccti-codex-CLPN.png');
  await page.click('#lang');                                    // la langue change, l'outil reste Codex
  await expect(page.locator('#card svg')).toContainText('The Night Surgeon');
  await expect(page.locator('#diagnosis')).not.toContainText('Claude');
  await page.locator('#tools button').nth(0).click();
  await expect(page.locator('#card svg')).toContainText('CLID');
  await expect(page.locator('#card svg')).toContainText('· Claude Code');
});

test('Claude + Codex compressé seulement : pas d\'onglet Codex vide', async ({ page }) => {
  await stubPicker(page, [...CLAUDE, ...ZST_ONLY]);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await expect(page.locator('#card svg')).toContainText('CLID');
});

test('Ajouter un dossier : Claude puis Codex, et un dossier déjà vu n\'est pas recompté', async ({ page }) => {
  await stubPicker(page, CLAUDE, CODEX, CLAUDE);
  await page.goto('/');
  await page.click('#pick');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#tools button')).toHaveCount(0);
  await page.click('#add');
  await expect(page.locator('#tools button')).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
  await page.click('#add');                                     // le même dossier Claude, une seconde fois
  await expect(page.locator('#tools button')).toHaveText(['Claude Code · 7 sessions', 'Codex · 2 sessions']);
});

test('démo : deux bilans, et « Analyser un autre dossier » remet les textes Claude', async ({ page }) => {
  await page.goto('/');
  await page.click('#demo');
  await expect(page.locator('#tools button')).toHaveCount(2);
  await expect(page.locator('#add')).toBeHidden();
  await expect(page.locator('#card svg')).toContainText("L'Architecte noctambule");
  await page.locator('#tools button').nth(1).click();
  await expect(page.locator('#card svg')).toContainText('Le Joueur de YOLO');
  await page.click('#again');
  await page.locator('#fallback').setInputFiles('tests/fixtures/projects');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('Claude vous a donné raison');
});

test('la page /codex/ n\'existe plus', async ({ page }) => {
  const r = await page.goto('/codex/');
  expect(r.status()).toBe(404);
});
```

Run: `npx playwright test tests/e2e/sources.spec.js`
Expected: FAIL (pas de `#tools`, résultat du worker non lu par la page) ; le dernier test passe déjà.

- [ ] **Step 5: `src/main.js` redevient la page**

```bash
git rm -q src/main.js && git mv src/app.js src/main.js
```

Dans `src/main.js` :

1. En-tête et imports (lignes 1-10) :
```js
// src/main.js — la page : états, sélection du dossier, worker, rendu, exports, langue, thème.
// Chaque fichier déposé est rattaché à son outil ; un bilan par outil, avec un sélecteur (spec CCTI Claude+Codex § 4).
import { detectLang, t, fmtInt, setTool } from './i18n.js';
import { computeProfile } from './profile.js';
import { renderCard, CARD_W, CARD_H } from './card.js';
import { renderDiagnosis, renderSections, diagnosisTexts, renderGallery, h } from './render.js';
import { accept, classify } from './sources.js';
import { createWorker } from './worker-factory.js';
import DEMO_STATS from './demo.js';
import CODEX_DEMO from '../codex/demo.js';

const $ = (id) => document.getElementById(id);
const state = { lang: detectLang(), reports: null, tools: [], tool: 'claude', stats: null, profile: null, entries: [], worker: null, demo: false, startedAt: 0 };
// préfixe des fichiers exportés : inchangé pour Claude, « ccti-codex » pour Codex
const prefix = () => (state.tool === 'codex' ? 'ccti-codex' : 'ccti');
```
(supprimer la ligne `let F = null; …`).
2. Remplacer `F.accept(` par `accept(` (4 occurrences), `F.classify(` par `classify(`, `F.createWorker()` par `createWorker()`, `${F.assetBase}assets/types/` par `assets/types/`, `${F.filePrefix}` par `${prefix()}` (5 occurrences).
3. Remplacer le gestionnaire `$('pick').addEventListener('click', async () => { … });` par une fonction partagée :
```js
// Sélecteur de dossier : depuis l'accueil, ou depuis le bilan pour ajouter le dossier de l'autre outil.
async function pickFolder() {
  if (window.showDirectoryPicker) {
    try {
      const hd = await window.showDirectoryPicker({ mode: 'read' });
      const out = [];
      beginScan();
      await collectFromHandle(hd, hd.name, out);
      endScan(out);
    } catch (err) { state.scanning = false; if (!err || err.name !== 'AbortError') { show('intro'); showError(String((err && err.message) || err)); } }
  } else $('fallback').click();
}
$('pick').addEventListener('click', pickFolder);
$('add').addEventListener('click', pickFolder);
```
4. Dans `start(entries)`, remplacer les trois premières lignes (`showError('');` / `const files = classify(entries);` / `if (!files.some…`) par :
```js
  showError('');
  // « Ajouter un dossier » : les fichiers déjà collectés restent ; un même fichier, atteint par deux
  // chemins différents, n'est compté qu'une fois (clé nom + taille + date, spec § 9).
  const seen = new Set(), all = [];
  for (const e of [...state.entries, ...entries]) {
    const k = `${e.file.name}:${e.file.size}:${e.file.lastModified}`;
    if (!seen.has(k)) { seen.add(k); all.push(e); }
  }
  const files = classify(all);
  if (!files.some((f) => !f.skip)) { show('intro'); showError(t(state.lang, 'ui.noFiles')); return; }
  state.entries = all;
```
et `setResult(d.stats)` par `setReports(d.reports)`.
5. Remplacer `function setResult…`, le gestionnaire `#demo` et le gestionnaire `#again` par :
```js
// Outils affichés : ceux qui ont au moins une session (à défaut, tous) ; le plus fourni d'abord.
function setReports(reports) {
  state.reports = reports;
  const withSessions = Object.keys(reports).filter((k) => reports[k].volume.sessions > 0);
  state.tools = (withSessions.length ? withSessions : Object.keys(reports))
    .sort((a, b) => reports[b].volume.sessions - reports[a].volume.sessions);
  selectTool(state.tools[0]);
  show('report');
}
function selectTool(tool) {
  state.tool = tool;
  setTool(tool);
  state.stats = state.reports[tool];
  state.profile = computeProfile(state.stats);
  renderReport();
}
$('demo').addEventListener('click', () => { state.demo = true; setReports({ claude: DEMO_STATS, codex: CODEX_DEMO }); });
$('again').addEventListener('click', () => {
  Object.assign(state, { reports: null, tools: [], stats: null, profile: null, demo: false, entries: [] });
  state.tool = 'claude'; setTool('claude');
  show('intro');
});
```
6. Dans `renderReport()`, après `$('demo-banner').hidden = !state.demo;` :
```js
  $('add').hidden = state.demo;
  renderTools();
```
et ajouter après `renderReport` :
```js
// Sélecteur d'outil, seulement si deux bilans existent. Vidé (pas masqué) sinon : son texte ne doit
// pas rester dans la page d'un bilan à un seul outil.
function renderTools() {
  const tools = state.tools.length > 1 ? state.tools : [];
  $('tools').replaceChildren(...tools.map((k) => {
    const on = k === state.tool;
    const b = h('button', { type: 'button', class: on ? 'primary' : null, 'aria-pressed': String(on),
      text: t(state.lang, k === 'codex' ? 'ui.toolCodex' : 'ui.toolClaude', { n: fmtInt(state.lang, state.reports[k].volume.sessions) }) });
    b.addEventListener('click', () => selectTool(k));
    return b;
  }));
}
```
7. Dans `reportSvg()`, après `clone.querySelector('.actions')?.remove();` : `clone.querySelector('#tools')?.remove();`
8. Remplacer `export function boot(flavor) { … }` (fin du fichier) par :
```js
applyI18n();
show('intro');
```

- [ ] **Step 6: `src/render.js`, `index.html`, `src/styles.css`, build**

`src/render.js` : supprimer le bloc `// Préfixe des illustrations…` / `let assetBase = '';` / `export function setAssetBase…`, et rétablir `img.src = \`assets/types/${lang}/${code}.webp\`;`.

`index.html`, dans `#report` : insérer `<div id="tools" class="tools"></div>` juste avant `<div id="card" class="card"></div>` ; remplacer
`<p><button id="again" type="button" class="link" data-i18n="ui.again"></button></p>` par
`<p><button id="add" type="button" class="link" data-i18n="ui.addFolder"></button> · <button id="again" type="button" class="link" data-i18n="ui.again"></button></p>`

`src/styles.css`, après la ligne `.actions { … }` :
```css
.tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
```

`scripts/build.mjs`, l'unique entrée de `TARGETS` :
```js
  { html: 'index.html', out: 'dist/ccti.html', css: 'src/styles.css', script: 'src/main.js',
    modules: [...SHARED, 'src/files.js', 'codex/files.js', 'src/sources.js', 'src/demo.js', 'codex/demo.js', 'src/worker-factory.js', 'src/main.js'],
    worker: ['src/patterns.js', 'src/pricing.js', 'src/analyzer.js', 'codex/pricing.js', 'codex/analyzer.js', 'src/worker-core.js', 'src/worker.js'] },
```
et retirer `'src/app.js'` de `SHARED`.

`tests/e2e/dist.spec.js`, ajouter :
```js
test('dist/ccti.html : sessions Codex et démo à deux bilans, en file://', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => { const p = new URL(r.url()).protocol; if (p !== 'file:' && p !== 'blob:' && p !== 'data:') urls.push(r.url()); });
  await page.goto('file://' + path.resolve('dist/ccti.html'));
  await page.locator('#fallback').setInputFiles('tests/fixtures-codex');
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card svg')).toContainText('CLPN');
  await page.reload();
  await page.click('#demo');
  await page.locator('#tools button').nth(1).click();
  await expect(page.locator('#card svg')).toContainText('Le Joueur de YOLO');
  expect(urls).toEqual([]);
});
```

- [ ] **Step 7: Run tests**

Run: `npm test && npm run build && npm run e2e`
Expected: PASS partout (CCTI existants, `sources.spec.js`, `dist.spec.js`).

- [ ] **Step 8: Commit**

```bash
git add -A src codex tests index.html scripts
git commit -m "feat: one page, one report per tool, tool switcher and add-a-folder

Claude-Session: https://claude.ai/code/session_0192DpdSD1TXL3ZbPURJoh8q"
```

---

### Task 4: Méta, README

**Files:**
- Modify: `index.html` (balises `<head>`), `README.md`, `README-fr.md`, `package.json` (`description`)
- Test: `tests/meta.test.js` (ajout)

- [ ] **Step 1: Write the failing test** — ajouter à `tests/meta.test.js` :

```js
// La page couvre deux outils : le titre et l'aperçu de partage doivent le dire.
test('titre et aperçu citent Claude Code et Codex', () => {
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  for (const s of [title, meta('property', 'og:title'), meta('name', 'description')]) {
    assert.ok(s.includes('Claude') && s.includes('Codex'), s);
  }
  assert.ok(title.includes('Claude and Codex Type Indicator'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/meta.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

`index.html` :
- `<title>CCTI — Claude and Codex Type Indicator</title>`
- description : `A 16-type personality test for you and Claude Code or Codex, computed locally from your session logs. Nothing uploaded.`
- `og:title` : `CCTI — Claude and Codex Type Indicator, a 16-type personality test for you and Claude Code or Codex`

`package.json` `description` : `A 16-type personality test for you and Claude Code or Codex, computed locally from your session logs.`

`README.md` :
- ligne 1 : `# CCTI — Claude and Codex Type Indicator`
- accroche : `You and Claude Code in four letters` → `You and Claude Code or Codex in four letters`
- `Drop your \`~/.claude/projects\` folder on a page.` → `Drop your \`~/.claude/projects\` or \`~/.codex/sessions\` folder on a page (or both: you get one report per tool).`
- `affiliated with neither Anthropic nor The Myers-Briggs Company. Claude is a trademark of Anthropic;` → `affiliated with neither Anthropic, OpenAI nor The Myers-Briggs Company. Claude is a trademark of Anthropic; Codex is a trademark of OpenAI;`
- fin de « How it works », ajouter : `Codex sessions (\`rollout-*.jsonl\`) are read by \`codex/analyzer.js\` and billed at OpenAI's public prices (\`codex/pricing.js\`); compressed \`.jsonl.zst\` files are counted, not read.`
- `Claude Code only, for now.` → supprimer la phrase.

`README-fr.md` : mêmes changements en français :
- ligne 1 : `# CCTI — Claude and Codex Type Indicator`
- `Votre binôme Claude Code en 4 lettres` → `Votre binôme Claude Code ou Codex en 4 lettres`
- `Glissez votre dossier \`~/.claude/projects\` sur une page.` → `Glissez votre dossier \`~/.claude/projects\` ou \`~/.codex/sessions\` sur une page (ou les deux : un bilan par outil).`
- `qui n'est affilié ni à Anthropic ni à The Myers-Briggs Company. Claude est une marque d'Anthropic ;` → `qui n'est affilié ni à Anthropic, ni à OpenAI, ni à The Myers-Briggs Company. Claude est une marque d'Anthropic ; Codex est une marque d'OpenAI ;`
- fin de « Comment ça marche », ajouter : `Les sessions Codex (\`rollout-*.jsonl\`) sont lues par \`codex/analyzer.js\` et facturées au tarif public d'OpenAI (\`codex/pricing.js\`) ; les fichiers compressés \`.jsonl.zst\` sont comptés, pas lus.`
- `Claude Code\nuniquement, pour l'instant.` → supprimer la phrase (attention : elle est coupée sur deux lignes).

- [ ] **Step 4: Run tests**

Run: `npm test && npm run build && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md README-fr.md package.json tests/meta.test.js
git commit -m "docs: CCTI is now the Claude and Codex Type Indicator

Claude-Session: https://claude.ai/code/session_0192DpdSD1TXL3ZbPURJoh8q"
```
