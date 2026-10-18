# CCTI — suites du postmortem (issue #2) — spec de conception

Date : 2026-10-18. Rédaction : Claude.
Statut : validée en brainstorm (points 1 à 5 de l'issue #2 ; point 3 : ne relire que l'outil touché).
Prolonge la spec `2026-10-18-codex-zst-design.md` : sa règle de doublons (décision 5) devient un cas de
l'identité stable définie ici (§ 3).

## 1. Résumé

L'issue GitHub #2 (postmortem de la version hybride, commit `647bb8d`) relève cinq défauts réels.
Ce cycle corrige :

1. la zone de dépôt, un bouton qui contient un autre bouton (accessibilité) ;
2. le double comptage d'un fichier réajouté après avoir grandi ;
3. la relecture de tout le corpus à chaque « Ajouter un dossier » ;
4. le choix de l'outil affiché après un ajout, fait au nombre de sessions ;
5. les erreurs de console du fichier autonome ouvert en `file://`.

Son point 6 (`.jsonl.zst`) est livré par le cycle précédent.

### Décisions (journal du brainstorm)

1. Zone de dépôt : `#drop` n'est plus un contrôle ; `#pick` est le seul.
2. Identité stable par fichier de session. À identité égale : le `.jsonl` l'emporte sur l'archive ;
   sinon le plus récent (`lastModified`), puis le plus gros ; à égalité, celui déjà retenu.
3. Les fichiers mis de côté (archive, version plus ancienne, copie) sont comptés dans la catégorie
   `duplicates` du reçu, libellée « doublons d'une session déjà lue ».
4. « Ajouter un dossier » ne relit que les outils touchés par le lot ; les bilans des autres outils
   sont repris tels quels.
5. Après un ajout, l'outil affiché est celui que le lot vient d'apporter, sinon l'outil affiché reste.
6. En `file:`, aucune illustration n'est demandée.

### Refusés (avec raisons, à reprendre dans la réponse à l'issue)

- Calcul vraiment incrémental : on ne sait pas retirer d'un bilan l'apport d'un fichier, ce qui casse
  le remplacement de la décision 2 ; un worker gardé en vie rend l'annulation d'un ajout fragile.
- Audit d'accessibilité automatisé (axe-core) : une dépendance pour un seul cas ; un test e2e ciblé suffit.
- Illustrations embarquées dans `ccti.html` : ~1,6 Mo de base64, le fichier passerait de 187 Ko à ~1,8 Mo
  pour un usage hors ligne marginal ; le `ccti.html` du site les affiche déjà.

### Non-objectifs

- Pas de changement du parseur ni des bilans.
- Pas de réponse sur l'issue sans l'accord de Jean-Paul.

## 2. Zone de dépôt (point 1)

- `index.html` : `#drop` perd `role="button"` et `tabindex="0"`.
- `src/main.js` : le gestionnaire `keydown` de `#drop` disparaît.
- `src/styles.css` : `.drop:focus-visible` disparaît (`.drop.over` reste).
- Le glisser-déposer reste sur `#drop` ; au clavier, `#pick` ouvre le sélecteur.

## 3. Identité stable et doublons (point 2)

`src/sources.js` :

- `identity(it)` :
  - Codex : `codex:<sessionId>` (le `sessionId` ne porte pas l'extension) ;
  - Claude : `claude:<slug>:<kind>:<sessionId>:<fichier>` — les fichiers de sous-agents partagent le
    `sessionId` de leur session parente. `<fichier>` est le nom du fichier pour une session principale, et
    pour un sous-agent son chemin sous `subagents/` : chaque workflow écrit son propre `journal.jsonl`
    (`subagents/workflows/wf_*/journal.jsonl`), le nom seul les confondrait (revue de branche, important 1).
- `addBatch(items, entries) → { items, added, touched, dups }` :
  - chaque item classé est comparé à l'item retenu de même identité (dans le même lot ou avant) ;
  - le gagnant suit la décision 2 ; le perdant est retiré des items (s'il y était) ou n'y entre pas ;
  - `added` : nombre d'items nouveaux ou remplaçants ;
  - `touched` : ensemble des outils d'un item nouveau ou remplaçant ;
  - `dups` : clés (`keyOf`) des fichiers mis de côté par ce lot, y compris un item retenu plus tôt et remplacé.
  - Un fichier atteint deux fois par deux chemins (même clé) n'est toujours examiné qu'une fois.
- `coverage(entries, items, dups)` : un fichier examiné absent des items dont la clé est dans `dups`
  compte dans `duplicates`. Le calcul `archiveId` disparaît. La somme des catégories reste `examined`.
- `src/main.js` : `state.dups` (ensemble) accumule les `dups` de chaque lot retenu, au même moment que
  `state.items` (à l'arrivée du résultat, ou tout de suite quand le lot n'ajoute rien). Remis à zéro
  par « Analyser un autre dossier ».
- Textes : `ui.covDuplicates` : FR « doublons d'une session déjà lue », EN « duplicates of a session
  already read ». Clé JSON `duplicates` inchangée ; masquée à l'écran quand elle vaut 0.

## 4. Ne relire que l'outil touché (point 3)

- Premier dépôt (aucun résultat d'analyse en mémoire, `state.result` nul : accueil ou démo) : tous les
  outils sont touchés, comportement inchangé.
- Ajout (un résultat d'analyse existe) : le worker reçoit seulement les items des outils de `touched`. Les bilans des autres outils
  sont repris de l'état courant.
- `src/sources.js`, `mergeRuns(prev, next, touched) → { reports, unreadable }` :
  - `reports` : ceux de `prev` pour les outils non touchés, plus ceux de `next` ;
  - `unreadable` : catégories d'illisibles rattachées à leur outil (`claude` → `claude` ;
    `codex` → `codex`, `compressed`) ; celles des outils non touchés viennent de `prev`, les autres de `next`.
- La progression compte les fichiers envoyés au worker.
- Annulation ou erreur pendant un ajout : l'état reste celui d'avant (inchangé).

## 5. Outil affiché (point 4)

- Premier dépôt : l'outil le plus fourni en sessions (inchangé).
- Après un ajout : un outil de `touched` qui n'avait aucune session avant et en a maintenant ; sinon
  l'outil affiché, s'il est toujours proposé ; sinon le plus fourni.
- L'ordre des boutons du sélecteur ne change pas (le plus fourni d'abord).

## 6. Fichier autonome en `file:` (point 5)

- `src/main.js` : en `location.protocol === 'file:'`, la galerie n'est pas rendue et sa section `#types`
  est masquée ; l'illustration de la carte n'est pas demandée (`illustration()` rend `null` sans `fetch`).
- Servie en HTTP (site, `ccti.html` publié), la page garde ses illustrations.

## 7. Tests

Unitaires (`tests/sources.test.js`) :

- Fichier réajouté après avoir grandi (même nom, plus gros, plus récent) : un seul item, le nouveau ;
  l'ancien dans `dups` ; `touched` = son outil ; `added` = 1.
- Même cas, version plus ancienne réajoutée : rien d'ajouté, elle va dans `dups`.
- Égalité de date : le plus gros l'emporte ; égalité totale de date et de taille, clés différentes :
  celui déjà retenu reste.
- Deux fichiers de sous-agents Claude d'une même session : tous deux retenus.
- Une session Codex présente dans deux dossiers d'un même lot : une seule retenue.
- Les tests de doublons `.jsonl` / `.jsonl.zst` existants passent à `coverage(entries, items, dups)`.
- `mergeRuns` : un outil non touché garde son bilan et ses illisibles (y compris `compressed`).

E2E :

- Accessibilité : `#drop` n'a ni `role` ni `tabindex` ; `#pick` est son seul descendant focusable ; la
  touche Entrée sur `#pick` ouvre le sélecteur.
- Réajout d'un dossier Claude dont un fichier a grandi : le nombre de sessions ne change pas ; le reçu
  compte l'ancienne version en doublon.
- Codex puis « Ajouter un dossier » Claude : le second lancement du worker ne reçoit que des fichiers
  Claude ; le bilan Codex est identique et le reçu garde « illisibles : 1 » (archive `f6`).
- Claude puis ajout de Codex : Codex s'affiche (il vient d'être apporté) bien qu'il ait moins de sessions ;
  sur Codex, réajouter le dossier Claude modifié laisse Codex affiché.
- `dist/ccti.html` en `file://` : aucune erreur dans la console, galerie masquée.

Critère de fin : `npm test`, `npm run build` et `npm run e2e` verts ; CI verte ; vérification en ligne.
La réponse à l'issue #2 est rédigée pour validation, pas postée.
