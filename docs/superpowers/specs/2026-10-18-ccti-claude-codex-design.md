# CCTI — Claude and Codex Type Indicator — spec de conception

Date : 2026-10-18. Rédaction : Claude.
Statut : validée en brainstorm (dépôt mixte, sort de /codex/, ajout de dossier, nom, carte, démo).
Remplace, pour la page, la spec CXTI `2026-10-18-cxti-design.md` : son parseur, sa grille de prix,
son tri des fichiers et ses textes Codex restent en vigueur ; sa page séparée disparaît.

## 1. Résumé

Une seule page, `https://sandjab.github.io/ccti/`, analyse les sessions **Claude Code**
(`~/.claude/projects`) et **Codex** (`~/.codex/sessions`). La source de chaque fichier est
reconnue automatiquement. Chaque outil a son propre bilan ; quand les deux sont présents,
un sélecteur passe de l'un à l'autre.

### Décisions (journal du brainstorm)

1. Dépôt mixte : **un bilan par outil**, avec un sélecteur. Jamais de bilan fusionné.
2. Le support de Codex devient **public** : accueil, README, aperçu de partage.
3. `/codex/` et `codex/cxti.html` **disparaissent** (404). Seul `ccti.html` reste hors ligne.
4. Bouton **« Ajouter un dossier »** sur le bilan, pour fournir le second outil avec le sélecteur de dossier.
5. Nom : **CCTI — Claude and Codex Type Indicator** (forme longue en anglais, FR et EN).
   Mention d'indépendance : Anthropic, OpenAI, The Myers-Briggs Company.
6. Carte : sous-titre `Claude and Codex Type Indicator · Claude Code` ou `· Codex` selon le bilan.
7. Démo : les deux bilans et le sélecteur (Claude AVPN, Codex ALID).
8. Exports : inchangés pour Claude (`ccti-<CODE>.png`, `ccti-<CODE>-full.png`, `ccti-stats.json`) ;
   infixe `codex` pour Codex (`ccti-codex-<CODE>.png`, `ccti-codex-<CODE>-full.png`, `ccti-codex-stats.json`).

### Non-objectifs

- Pas de bilan fusionné, pas de comparaison chiffrée entre outils.
- Pas de parcours du dossier personnel entier.
- Pas d'autre outil (Cursor, OpenCode…).

## 2. Détection

`src/sources.js` (nouveau) expose :

- `accept(name)` : `.jsonl` ou `.jsonl.zst`.
- `classify(entries) → items` : concatène `classifyClaude(entries)` (`src/files.js`) marqué
  `tool: 'claude'` et `classifyCodex(entries)` (`codex/files.js`) marqué `tool: 'codex'`.

Garde-fou : `src/files.js` ignore tout fichier dont le nom commence par `rollout-`
(sinon un dossier de jour Codex glissé seul, `05/rollout-….jsonl`, serait lu comme un projet Claude).
Les règles existantes de `src/files.js` (racine commune, `projects/`) ne changent pas autrement :
avec `.claude` et `.codex` déposés ensemble, les fichiers Codex ne sont pas sous `projects/`
et sont déjà écartés par le tri Claude.

Un dépôt sans aucun fichier lisible (ni Claude, ni Codex non compressé) affiche le message
« aucune session », qui cite les deux dossiers et `zstd -d`.

## 3. Analyse

Un seul worker (`src/worker.js`) reçoit les items marqués. Il crée un analyseur par outil présent
(`Analyzer` pour Claude, `CodexAnalyzer` pour Codex) et renvoie
`{ type: 'result', reports: { claude?: stats, codex?: stats }, bytes }`.
Un outil sans aucun item n'a pas de clé. La progression porte le total des fichiers et
la somme des sessions des deux analyseurs.

`src/worker-core.js` est adapté : `runWorker` aiguille chaque item vers l'analyseur de son outil.

## 4. Page

- `src/app.js` perd la notion de saveur : il importe directement `sources.js`, la démo et le worker.
  `src/main.js` redevient le point d'entrée unique.
- État : `state.reports = { claude?, codex? }`, `state.tool` = outil affiché, `state.entries` = fichiers collectés.
- **Sélecteur** (`#tools`) : visible seulement si les deux outils ont un bilan. Deux boutons
  « Claude Code · N sessions » et « Codex · N sessions » (`aria-pressed`). Changer d'outil
  re-rend carte, diagnostic, sections, et règle les exports et le texte de partage.
  Outil affiché par défaut : celui qui a le plus de sessions.
- **« Ajouter un dossier »** (`#add`) : sur le bilan, hors démo. Rouvre le sélecteur de dossier
  (ou l'`input` de repli) ; les nouveaux fichiers s'ajoutent à `state.entries`, dédoublonnés
  par `nom + taille + date de modification` du fichier (§ 9) ; tout est réanalysé.
- Le bandeau « faible échantillon » et le bandeau démo s'appliquent au bilan affiché.

## 5. Textes

`src/i18n.js` porte deux jeux : Claude (les dictionnaires actuels) et Codex, construit au chargement par
`codexTexts(dict, lang)` de `codex/i18n.js` (fonction pure : remplacement Claude → Codex, puis clés réécrites,
comme la spec CXTI § 3.4 ; elle ne modifie plus rien en place). `t(lang, key)` lit le jeu de
l'outil courant, fixé par `setTool('claude' | 'codex')`. Les dictionnaires Claude ne sont jamais modifiés.

Textes de l'accueil et du pied de page, communs, dans les deux jeux :

- `ui.title` : `CCTI` ; `card.subtitle` : `Claude and Codex Type Indicator · Claude Code` ou `· Codex`.
- Accroche, pitch, consigne de dépôt, « Où est mon dossier ? », « aucune session » : citent les deux outils
  et les deux dossiers.
- Pied de page : indépendance vis-à-vis d'Anthropic, d'OpenAI et de The Myers-Briggs Company.
- Texte de partage et `card.site` : `sandjab.github.io/ccti`.

Les textes propres à un bilan (types, observations, libellés, aide des axes, facture) restent par outil.

## 6. Ce qui disparaît

`codex/index.html`, `codex/main.js`, `codex/worker.js`, `codex/worker-factory.js`,
`applyCodexTexts()` (remplacé par la fonction pure `codexTexts`),
la cible `dist/cxti.html` du build, les lignes CXTI de la CI, `tests/e2e/cxti.spec.js`
(remplacé), le cas `dist/cxti.html` de `tests/e2e/dist.spec.js` (remplacé), et l'interface `boot(flavor)`.

## 7. Méta et documentation

- `index.html` : titre, description et balises OG/Twitter disent « Claude Code and Codex ».
  L'image OG `assets/card-light.png` n'est pas régénérée dans cette version (elle montre une carte Claude, toujours valide).
- README EN et FR : nom long, les deux dossiers, mention OpenAI. Le GIF de démo n'est pas régénéré.

## 8. Tests et critères de succès

Chaque critère est porté par un test qui échoue si la règle change :

- un fichier `rollout-*` n'est jamais classé Claude ; un fichier Claude n'est jamais classé Codex ;
- dépôt Claude seul : bilan Claude, pas de sélecteur, carte `· Claude Code`, exports `ccti-*` inchangés ;
- dépôt Codex seul : bilan Codex, pas de sélecteur, carte `· Codex`, exports `ccti-codex-*`, aucun « Claude » dans le bilan ;
- dépôt mixte : sélecteur avec les deux nombres de sessions, bascule effective (carte, diagnostic, exports) ;
- « Ajouter un dossier » : un bilan Claude devient mixte après ajout des sessions Codex ;
- démo : sélecteur, AVPN et ALID ;
- `ccti.html` en `file://` : dépôt mixte et démo, aucune requête réseau ;
- `/codex/` n'existe plus dans le site assemblé ;
- les tests unitaires Codex (parseur, prix, tri, textes) passent inchangés, sauf leur import des textes.

## 9. Risques

- **Texte commun trop long** pour la carte : sous-titre avec suffixe d'outil, à vérifier sur la carte rendue.
- **Dédoublonnage** : un même dossier ajouté deux fois par deux chemins différents (le parent puis
  l'enfant) produit des chemins relatifs différents ; la clé est donc `nom + taille + date de modification`
  du fichier. Les noms de session sont des UUID (Claude) ou horodatés (Codex) : collision improbable.
- **Liens existants vers `/codex/`** : 404 assumé (décision 3).
