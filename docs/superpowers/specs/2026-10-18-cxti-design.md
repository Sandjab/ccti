# CXTI — spec de conception (CCTI pour Codex)

Date : 2026-10-18. Rédaction : Claude.
Statut : validée en brainstorm (périmètre, architecture, correspondance des métriques, fichiers `.zst`).
Référence : la spec CCTI `2026-10-16-divan-design.md` (désignée ci-dessous « spec CCTI »).

## 1. Résumé

**CXTI — Codex Type Indicator** est la page sœur de CCTI pour les sessions de
l'agent OpenAI Codex. Même test (4 axes, 16 types, mêmes illustrations), mêmes
compteurs quand ils ont un équivalent, même carte, même engagement : tout est
calculé dans le navigateur, rien n'est envoyé.

URL : `https://sandjab.github.io/ccti/codex/` (+ fichier autonome
`https://sandjab.github.io/ccti/codex/cxti.html`).

### Décisions (journal du brainstorm)

1. Rapport **séparé** pour Codex (pas de fusion avec les sessions Claude, pas de comparaison).
2. Répertoire `codex/` pour le spécifique ; le cœur (`src/`) est partagé, pas copié.
3. **Aucun lien** vers la page Codex : ni depuis la page CCTI, ni depuis les README.
   Accès par l'URL directe uniquement. Hypothèse retenue : `<meta name="robots" content="noindex">`
   sur la page CXTI, pour qu'elle ne remonte pas non plus dans les moteurs.
4. Nom : **CXTI — Codex Type Indicator**. Mention d'indépendance : ni Anthropic, ni OpenAI,
   ni The Myers-Briggs Company.
5. Approche A : le code commun reçoit une « saveur » (§ 3).
6. Le réglage par défaut de Codex (`on-request` + `workspace-write`) compte en **contrôle** :
   l'axe mesure si l'utilisateur a relâché les réglages d'origine.
7. Fichiers compressés `.jsonl.zst` : **ignorés et comptés**, aucune dépendance ajoutée.

### Non-objectifs

- Pas de fusion ni de comparaison Claude / Codex.
- Pas de décodeur zstd.
- Pas de CLI Node pour Codex (le CLI reste un outil interne CCTI).
- Pas de tarif long contexte (≥ 272K) ni de notions de cache façon Anthropic.
- Aucun changement visible sur la page CCTI.

## 2. Données d'entrée

### 2.1 Arborescence

Codex écrit `~/.codex/sessions/AAAA/MM/JJ/rollout-<horodatage>-<uuid>.jsonl`
(variante après retour arrière : `rollout-<ts>-<thread>_<rollout>.jsonl`).
On peut déposer `~/.codex`, `~/.codex/sessions` ou n'importe quel sous-dossier.

Règle de tri (`codex/files.js`) : tout fichier dont le nom commence par `rollout-`
et finit par `.jsonl` est une session ; ceux qui finissent par `.jsonl.zst` sont
comptés comme « compressés ignorés » ; tout le reste est ignoré (`history.jsonl`,
`session_index.jsonl`, sqlite…). Le chemin ne décide pas du type de session :
c'est la ligne `session_meta` (§ 2.3).

### 2.2 Enveloppe

Chaque ligne : `{timestamp, ordinal?, type, payload}`. Types utilisés :
`session_meta`, `turn_context`, `response_item`, `event_msg`, `compacted`.
Les autres (`world_state`, `token_usage_record`, `inter_agent_communication`…) sont ignorés.

Deux modes d'historique (`session_meta.payload.history_mode`) : `legacy` (défaut)
et `paginated`. Ce qui est persisté diffère (§ 2.4).

### 2.3 Session principale, sous-agent, interne

À partir de `session_meta.payload` :

- **interne**, ignorée entièrement (ni session, ni sous-agent) : `source.internal`
  présent, ou `thread_source` ∈ {`guardian_review`, `memory_consolidation`}, ou
  `source.subagent` ∈ {`compact`, `memory_consolidation`}.
- **sous-agent** : `source.subagent` présent (autres valeurs), ou `thread_source = "subagent"`.
  Les lignes d'`ordinal` < `subagent_history_start_ordinal` (historique hérité du parent)
  sont ignorées.
- **principale** : tout le reste.

Projet : nom du dernier segment de `session_meta.payload.cwd`.
Version : `session_meta.payload.cli_version`.

### 2.4 Message humain (définition normative)

Une seule source par mode, pour ne jamais compter deux fois :

- `legacy` : `event_msg` de `payload.type = "user_message"`, texte dans `payload.message`.
- `paginated` : `event_msg` de `payload.type = "item_completed"` dont `payload.item.type = "UserMessage"`.
  La forme exacte du texte dans `item` est à confirmer sur la fixture réelle disponible
  (la session locale de l'auteur est en `paginated`) avant d'écrire le parseur.

Les messages `response_item` de rôle `user` sont **ignorés** (doublons, et ils
contiennent le contexte injecté : AGENTS.md, `<environment_context>`…).
Le texte passe ensuite par `cleanText` (spec CCTI § 3.3), comme pour Claude.
Seules les sessions principales comptent des messages humains.

## 3. Architecture : la saveur

### 3.1 Fichiers

```
codex/
  index.html          page CXTI : mêmes ids que index.html ; ../src/styles.css ; main.js
  main.js             import { boot } from '../src/app.js' ; boot(codexFlavor)
  files.js            tri des fichiers (§ 2.1)
  analyzer.js         CodexAnalyzer : même interface et même schéma de stats que Analyzer
  worker.js           runWorker(CodexAnalyzer) (cf. § 3.3)
  worker-factory.js   comme src/worker-factory.js, pointe vers ./worker.js
  pricing.js          grille OpenAI (§ 4.4)
  demo.js             stats de démonstration plausibles (schéma Codex, avec null)
  i18n.js             surcouche FR/EN (§ 3.4)
tests/
  codex-files.test.js, codex-analyzer.test.js, codex-pricing.test.js, codex-i18n.test.js
  fixtures/codex/sessions/2026/…   fixtures synthétiques (§ 6)
  e2e/cxti.spec.js
```

Les tests restent à la racine de `tests/` : le script `npm test` lit `tests/*.test.js`.

### 3.2 Interface de saveur

Le contenu actuel de `src/main.js` passe dans `src/app.js`, qui exporte `boot(flavor)`.
`src/main.js` devient le point d'entrée CCTI : un import et `boot(claudeFlavor)`.
`index.html` et la règle d'inlining de `build.mjs` restent donc inchangés pour CCTI ;
`codex/main.js` importe `../src/app.js`. La page CCTI garde exactement son comportement.

```js
flavor = {
  accept(name),        // le collecteur garde ce fichier ? (CCTI : .jsonl ; CXTI : .jsonl et .jsonl.zst)
  classify(entries),   // CCTI : src/files.js ; CXTI : codex/files.js
  createWorker(),
  demo,                // stats de démonstration
  assetBase,           // '' (CCTI) ou '../' (CXTI) pour assets/types/…
  filePrefix,          // 'ccti' ou 'cxti' : noms des PNG / JSON exportés
}
```

Le nom affiché (en-tête, carte, partage) vient des textes (`ui.title`), pas de la saveur.
`card.js` lit le nom via `t(lang, 'ui.title')` au lieu du `CCTI` écrit en dur.
`typeImage` (render.js) et `illustration` (main.js) préfixent `assetBase`.

### 3.3 Worker

Le corps de `src/worker.js` (lecture en flux, progression) devient
`runWorker(AnalyzerClass)` dans `src/worker-core.js`. `src/worker.js` et
`codex/worker.js` se réduisent à un import et un appel. Le message de résultat
porte en plus `compressedSkipped` pour CXTI.

### 3.4 Textes

`src/i18n.js` gagne `extendLangs(overrides)` : fusion profonde, appelée une fois
par `codex/main.js` avant `boot`. La surcouche CXTI :

1. part des dictionnaires CCTI ;
2. remplace mécaniquement `Claude Code` puis `Claude` par `Codex` dans tous les
   textes (types, observations, libellés) — transformation déterministe ;
3. réécrit explicitement les clés où le remplacement ne suffit pas : titre, sous-titre,
   accroche, emplacements du dossier (`~/.codex/sessions`), message « aucune session »,
   explication de l'axe A (réglages Codex au lieu des modes Claude), pied de page
   (mention OpenAI), textes de partage (URL `/codex/`), libellé du fichier hors ligne,
   avertissement de la facture, libellé « sessions compressées ignorées ».

Un test vérifie qu'aucun texte CXTI ne contient « Claude » (sauf le libellé
« You're absolutely right », expression citée).

### 3.5 Valeurs absentes

Une mesure sans équivalent Codex vaut `null` dans les stats. `render.js` omet
toute ligne dont la valeur est `null`, et toute section dont toutes les lignes sont omises.
Pour CCTI, aucune valeur n'est `null` : rendu inchangé.
`profile.js` : l'observation `questions` exige `questionsAnswered !== null`.

### 3.6 Build et déploiement

- `scripts/build.mjs` produit `dist/ccti.html` (inchangé) et `dist/cxti.html`
  (même procédé, liste de modules CXTI, entrée `codex/index.html`).
- CI : `_site/codex/` reçoit `codex/*.js`, `codex/index.html`, et `dist/cxti.html`.
  `src/` et `assets/types/` sont déjà publiés et servis via `../`.

## 4. Métriques : correspondance

### 4.1 Axes (formules de `profile.js` inchangées)

| Axe | Source Codex |
|---|---|
| A — Contrôle / Autonomie | Chaque message humain est compté sous le mode du `turn_context` de son tour (le `turn_context` suit le message dans le fichier : le message est rattaché au prochain `turn_context` du même tour, ou au dernier connu à défaut). Correspondance : `approval_policy = "never"` et `sandbox_policy.type = "danger-full-access"` → `bypassPermissions` ; `"never"` seul → `auto` ; `on-request`, `on-failure`, `untrusted`, `{granular}` → `default`. Friction = (interruptions + refus) / messages. |
| V — Verbeux / Laconique | Inchangé (médiane des longueurs nettoyées). |
| P — Planificateur / Impulsif | Session planifiée si un `turn_context` a `collaboration_mode.mode = "plan"`, ou premier message ≥ 600 caractères. `update_plan` n'entre pas en compte. |
| N — Nocturne / Diurne | Inchangé. |

`control.permissionModes` garde les clés CCTI ; la surcouche de textes les libelle
à la manière de Codex.

### 4.2 Compteurs

| Stat | Source Codex |
|---|---|
| `assistantTurns` / `subagentTurns` | Nombre de hausses du cumul `token_count.info.total_token_usage.total_tokens` (une hausse = une réponse du modèle). `info: null` et `token_count` synthétiques (tous les champs à 0 sauf `total_tokens`) ignorés. |
| `claudeAgreed`, `absolutelyRight`, `claudeApologized`, `assistantChars` | Textes `output_text` des `response_item` `message` de rôle `assistant`, sessions principales ; ignorés si `metadata.delivered_assistant_message` est présent. |
| `humanNo`, `humanCaps`, `humanSwear`, `humanThanks`, `humanDoubleMarks`, `rageQuits`, `talkRatio`, `patienceMedianSec` | Inchangés, sur les messages humains du § 2.4 ; la patience se mesure depuis le dernier message assistant. |
| `interruptions` | `event_msg` `turn_aborted` avec `reason = "interrupted"`. |
| `toolDenials` | Heuristique : sortie de `function_call_output` / `custom_tool_call_output` qui contient `rejected by user`. |
| `questionsAsked` | `function_call` de nom `request_user_input` (session principale). |
| `toolCalls`, `toolsByName` | `function_call` (nom), `custom_tool_call` (nom), `local_shell_call` → `shell`, `web_search_call` → `web_search`. |
| `danger.*` | Motifs `DANGER` sur la commande : `exec_command` → `arguments.cmd` ; `shell` → `arguments.command` (tableau joint par des espaces) ; `shell_command` → `arguments.command` ; `local_shell_call` → `action.command` joint. |
| `claudeWorkMinutes` | Somme des `duration_ms` de `task_complete` et de `turn_aborted`. |
| `compactions` | Lignes `compacted`. |
| `maxContext` | Maximum de `last_token_usage.input_tokens`. |
| `versions` | `cli_version`. |
| `volume.compressedSkipped` (nouveau, CXTI seulement) | Nombre de `.jsonl.zst` trouvés. Affiché si > 0, avec la consigne `zstd -d`. |

### 4.3 Valeurs `null` (masquées)

`questionsAnswered`, `interruptionsForTool`, `autoModeBlocks`, `modelRefusalFallbacks`,
`control.slashCommands`, `waste.turnsOver150k`, `waste.turnsOver150kShare`,
`waste.costOver150kUsd`, `waste.costOver150kShare`, `waste.cacheRebuilds`,
`waste.cacheRebuildsShortPause`, `waste.cacheRebuildExcessUsd`.

### 4.4 Facture

Chaque hausse du cumul `total_token_usage` est attribuée au `model` du dernier
`turn_context`. Par modèle : `input = input_tokens − cached_input_tokens`,
`cacheRead = cached_input_tokens`, `cacheWrite = cache_write_input_tokens` (0 si absent),
`output = output_tokens` (raisonnement inclus). Prix de base Standard, USD par million,
relevés le 2026-10-18 sur developers.openai.com/api/docs/pricing et les pages modèles :

| Modèle | Entrée | Entrée en cache | Sortie |
|---|---|---|---|
| gpt-5, gpt-5-codex, gpt-5.1, gpt-5.1-codex, gpt-5.1-codex-max | 1,25 | 0,125 | 10 |
| gpt-5.1-codex-mini | 0,25 | 0,025 | 2 |
| gpt-5.2, gpt-5.2-codex, gpt-5.3-codex | 1,75 | 0,175 | 14 |
| gpt-5.4 | 2,50 | 0,25 | 15 |
| gpt-5.5 | 5 | 0,50 | 30 |
| gpt-5.6-sol / -terra / -luna | 4 / 2 / 0,20 | 0,40 / 0,20 / 0,02 | 20 / 12 / 1,20 |
| codex-mini-latest | 1,50 | 0,375 | 6 |
| o3 / o4-mini | 2 / 1,10 | 0,50 / 0,275 | 8 / 4,40 |

À relever au moment de coder : les prix `gpt-6-*` (dont `gpt-6-astra`) et le prix
d'écriture en cache des `gpt-5.6-*` (colonne non confirmée). Préfixe le plus long
gagnant, comme `src/pricing.js`. Modèle inconnu → tokens non tarifés.

## 5. Confidentialité

Mêmes engagements que CCTI (spec CCTI § 8). Le JSON exporté par CXTI ne contient
aucun texte de conversation ni chemin : test dédié sur les stats produites par
`CodexAnalyzer` à partir des fixtures (aucune chaîne > 80 caractères, aucun `/` ou `\`, hors `meta`).

## 6. Tests et critères de succès

Fixtures synthétiques écrites à la main d'après le code source de Codex, plus la
forme réelle de `item_completed` / `UserMessage` relevée sur la session locale
(structure seulement, aucun texte copié) :

1. session `legacy` complète : prompts, réponses, outils, commande dangereuse, refus,
   interruption, `token_count` (dont un `info: null` et un synthétique), plan mode, deux modèles ;
2. session `paginated` équivalente ;
3. sous-agent avec historique hérité (`subagent_history_start_ordinal`) ;
4. session interne (guardian) ;
5. un fichier `.jsonl.zst` factice.

Critères (chacun vérifié par un test qui échoue si la règle métier change) :

- un message humain = un seul comptage, en `legacy` comme en `paginated` ;
- l'historique hérité d'un sous-agent n'est pas recompté ; une session interne ne compte pas ;
- la facture est exacte au centime sur les fixtures, `token_count` synthétiques exclus ;
- `on-request` + `workspace-write` donne un axe A côté contrôle ; `never` + `danger-full-access` côté autonomie ;
- les valeurs du § 4.3 sont `null`, et leurs lignes absentes du rendu ;
- aucun texte CXTI ne contient « Claude » (hors citation) ;
- e2e : `/codex/` charge, dépôt des fixtures → bilan, carte marquée `CXTI`, aucune requête réseau ;
  `dist/cxti.html` fonctionne en `file://` ; démo fonctionnelle ;
- **non-régression** : tous les tests unitaires et e2e CCTI existants passent sans modification.

Limite assumée : tant que le parseur n'a pas tourné sur un vrai historique Codex
de plusieurs dizaines de sessions, il est « vérifié sur fixtures synthétiques », pas plus.

## 7. Risques

- **Format mouvant** : Codex change souvent ses outils de shell (`shell` → `shell_command`
  → `exec_command`) et ses événements. Les trois formes connues sont lues ; une forme
  nouvelle passera inaperçue (compteurs danger à 0).
- **Refus** : heuristique sur le texte de sortie ; le texte exact du client TUI n'est pas confirmé.
- **Fork utilisateur** (`forked_from_id`) : on ne sait pas si l'historique du parent
  est recopié. Si oui, il serait compté deux fois. Non traité dans cette version.
- **Un seul vrai fichier** disponible pour l'auteur (court, interrompu).
- **Modèles `gpt-6-*`** : prix à confirmer ; sinon facture partielle (« tokens non tarifés »).
