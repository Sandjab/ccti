# CCTI — décompression des sessions Codex `.jsonl.zst` — spec de conception

Date : 2026-10-18. Rédaction : Claude.
Statut : validée en brainstorm (approche 1 : fzstd recopié dans `vendor/` ; retrait de la voie `skip`).
Modifie la spec CXTI `2026-10-18-cxti-design.md` sur un seul point, sa décision 7 (« `.jsonl.zst`
ignorés et comptés, aucune dépendance ajoutée ») : les `.jsonl.zst` sont désormais **lus**.
Donne suite à l'issue GitHub #1.

## 1. Résumé

Codex compresse une partie de ses sessions en `rollout-*.jsonl.zst`. Aujourd'hui, CCTI les compte sans
les lire. Désormais, le Web Worker les décompresse en flux, dans le navigateur, et les analyse comme
les `.jsonl`. Aucune requête réseau : le décodeur est un fichier du dépôt.

### Décisions (journal du brainstorm)

1. Décodeur : **fzstd 0.1.1** (MIT, ~24 Ko non minifié, sans dépendance), recopié tel quel dans
   `vendor/fzstd.js` depuis `esm/index.mjs` du paquet npm, avec la licence en tête. Pas de CDN, pas
   de npm à l'exécution, pas de WebAssembly.
2. La voie `skip` disparaît entièrement : `skip: true`, `skipFile()`, `volume.compressedSkipped`,
   le libellé `labels.compressedSkipped` et son affichage.
3. Le reçu garde sa catégorie `compressed` (même clé dans le JSON exporté), libellée désormais
   « archives .jsonl.zst décompressées ». Un `.zst` illisible quitte cette catégorie pour « illisibles ».
4. Validation finale sur de vrais `.jsonl.zst` Codex par Jean-Paul, depuis un autre poste, avant de
   fermer l'issue #1. Pas de commentaire sur l'issue sans son accord.
5. Doublons : `zstd -d` garde l'archive. Quand `rollout-X.jsonl` et `rollout-X.jsonl.zst` sont tous deux
   présents (même dépôt ou « Ajouter un dossier »), **le `.jsonl` l'emporte** : l'archive n'est pas lue,
   et le reçu la range dans une nouvelle catégorie « archives déjà décompressées » (clé `duplicates`).

### Constaté pendant le brainstorm (essai jetable, hors dépôt)

- Le décodeur en flux de fzstd, nourri par blocs de 64 Ko, restitue à l'octet près une session
  Claude de 56 Mo compressée par `zstd` aux niveaux 3, 19, 22 `--ultra`, et 19 `--long=27`/`--long=31`.
  Environ 0,2 s sous Node 26.
- La limite documentée de fzstd (niveau ≥ 20 et plus de 32 Mo décompressés) ne s'est pas montrée.
  Si elle se montre, le fichier est compté illisible (§ 4), sans casser l'analyse.
- Aucun navigateur ne propose `DecompressionStream('zstd')` par défaut.

### Non-objectifs

- Pas de décompression dans le CLI (`scripts/cli.mjs` ne lit que Claude Code).
- Pas d'autre format compressé (`.gz`, `.zst` hors `rollout-*`, `.zst` Claude Code).
- Pas de reprise de l'image OG ni du GIF de démo.

## 2. Décodeur embarqué

- `vendor/fzstd.js` : contenu identique, octet pour octet, à `package/esm/index.mjs` de `fzstd@0.1.1`,
  précédé d'un commentaire d'en-tête (provenance, version, licence MIT et son texte complet).
  Un test compare l'empreinte SHA-256 du corps (après l'en-tête) à celle du fichier publié, notée
  en dur dans le test.
- `src/worker-core.js` importe `{ Decompress }` depuis `../vendor/fzstd.js`.
- `scripts/build.mjs` :
  - ajoute `vendor/fzstd.js` à la liste `worker`, avant `src/worker-core.js` ;
  - `wrap()` sait réécrire deux formes d'export de plus, celles de fzstd :
    `export var X = …` (→ `var X = …`, X exporté) et `export { A, B };` (ligne retirée, A et B exportés) ;
  - `wrap()`, `modName()` et `resolveRel()` passent dans `scripts/lib/bundle.mjs` pour être testés sans
    lancer l'assemblage (même usage que `scripts/lib/walk.mjs`, partagé par le CLI et les tests) ;
    `vendor/fzstd.js` y reçoit le nom `__m_vendor_fzstd`, sans changement de `modName()`.
  - Le build échoue si une ligne `export` reste non réécrite (garde-fou contre une forme inconnue).
- CI (`.github/workflows`) : l'étape « Assemble site » copie aussi `vendor/*.js` dans `_site/vendor/`.

## 3. Lecture en flux

`readLines(file, onLine, onBytes, zst)` dans `src/worker-core.js` :

- `zst` faux : inchangé.
- `zst` vrai : `file.stream()` passe par un `TransformStream` qui pousse chaque bloc dans
  `new Decompress(ondata)` et relaie les blocs décompressés ; au `flush`, `push(new Uint8Array(0), true)`
  signale la fin (fzstd lève une erreur si le flux est tronqué). Puis `TextDecoderStream`, comme avant.
- Progression : `onBytes` compte les **caractères décodés**, comme aujourd'hui pour les `.jsonl`.
  Le « Mo lus » affiché reflète donc le volume de texte analysé, compressé ou non.
- Le `runWorker` passe `it.zst` à `readLines`.

## 4. Tri des fichiers et reçu

- `codex/files.js` : un `rollout-*.jsonl.zst` donne `{ file, sessionId, zst: true }` (au lieu de
  `skip: true`). `sessionId` reste le nom sans `.jsonl.zst`.
- `src/sources.js` :
  - `addBatch` compte les `.zst` dans `added` (ils sont lisibles) ;
  - `coverage` range un item `zst` dans `compressed`, les autres dans leur outil.
- Doublons (décision 5), par `sessionId`, seulement entre les deux formes (`.jsonl` / `.jsonl.zst`) :
  - `codex/files.js` (`classify`) : dans un même lot, un `.zst` dont le `.jsonl` est présent est écarté ;
  - `addBatch` : une archive dont la session est déjà lue en `.jsonl` n'est pas ajoutée ; un `.jsonl`
    qui arrive après son archive la remplace dans les items ;
  - `coverage` : un `rollout-*.jsonl.zst` examiné mais absent des items, dont le `sessionId` est lu en
    `.jsonl`, compte dans `duplicates`. La somme des catégories reste le nombre de fichiers examinés.
- `src/worker-core.js` : `unreadable` est indexé par **catégorie du reçu** : `compressed` pour un item
  `zst`, sinon l'outil (`claude`, `codex`).
- `src/main.js` (`receipt`) : pour chaque clé `k` de `unreadable`, `c[k] -= unreadable[k]` ;
  `c.unreadable` est leur somme. La somme des catégories reste le nombre de fichiers examinés.

## 5. Textes

- `ui.covCompressed` : FR « archives .jsonl.zst décompressées », EN « decompressed .jsonl.zst archives ».
- `ui.covDuplicates` (nouveau) : FR « archives déjà décompressées », EN « already decompressed archives »,
  affiché juste après `covCompressed`.
- `ui.noFiles` et `ui.nothingAdded` (FR, EN) : la consigne « zstd -d » disparaît.
- `labels.compressedSkipped` (`codex/i18n.js`) : supprimé.
- README (EN, FR) : « compressed `.jsonl.zst` files are counted, not read » devient : ils sont
  décompressés dans le navigateur par fzstd (MIT), embarqué dans `vendor/`. La mention de licence
  du README cite fzstd.

## 6. Retrait de la voie `skip`

Supprimés : `CodexAnalyzer.skipFile`, `compressedSkipped` (constructeur, `result()`), la ligne
correspondante de `src/render.js`, `compressedSkipped` dans `codex/demo.js`, la branche `it.skip`
de `src/worker-core.js` et de `tests/codex-helpers.js`. Aucun `skip` ne reste dans `src/`, `codex/`, `tests/`.

## 7. Tests

Fixtures (`scripts/gen-codex-fixtures.mjs`, compression par `node:zlib` `zstdCompressSync`) :

- `tests/fixtures-codex/…/rollout-…-f6.jsonl.zst` reste un **faux** zstd : il sert désormais de cas
  « illisible ». Le profil du dossier `tests/fixtures-codex` ne change pas (le fichier n'apportait
  déjà aucune session).
- `tests/fixtures-codex-zst/…/rollout-…-f7.jsonl.zst` devient une **vraie** session Codex compressée
  (contenu d'une session existante des fixtures, niveau 19).

Unitaires :

- Équivalence : une session `.jsonl` et la même compressée (niveaux 3 et 19, compressés dans le test)
  donnent le même bilan Codex. Le test échoue si la décompression est absente ou fausse.
- Un `.zst` corrompu ou tronqué : compté dans `unreadable.compressed`, l'analyse continue et les
  autres fichiers sont lus.
- `codex/files.js`, `src/sources.js` : `zst: true`, `added` les compte, `coverage` les range dans `compressed`.
- Doublons : même lot, archive puis `.jsonl` (ajout), `.jsonl` puis archive (ajout) ; une seule session
  lue à chaque fois, `duplicates` à 1, somme des catégories égale à `examined`.
- `scripts/build.mjs` : `wrap()` réécrit `export var` et `export { … };` ; le bundle du worker
  évalue `Decompress` ; une forme d'export inconnue fait échouer le build.
- `vendor/fzstd.js` : empreinte du corps égale à celle de `fzstd@0.1.1`.
- i18n : plus aucune mention de « zstd -d ».

E2E (page servie et `dist/ccti.html`) :

- Le faux sélecteur de dossier (`stubPicker`) et les helpers `read()` transmettent les fichiers en
  octets (base64), pas en texte UTF-8 : un `.zst` lu en UTF-8 serait abîmé.
- Ajout d'un dossier ne contenant qu'un vrai `.zst` après un dossier Claude : le sélecteur apparaît
  avec un bilan Codex d'une session (remplace le test « compressé seulement : message zstd -d »).
- Reçu sur `tests/fixtures-codex` : « archives .jsonl.zst décompressées : 0 », « illisibles : 1 » ;
  JSON `compressed: 0, duplicates: 0, unreadable: 1`, `examined` inchangé (9).
- `dist/ccti.html` : un vrai `.zst` est lu dans le fichier autonome (worker Blob), sans requête externe.

Critère de fin : `npm test` et `npm run e2e` verts, CI verte, page en ligne qui sert `vendor/fzstd.js` (200),
puis validation de Jean-Paul sur ses vrais `.jsonl.zst`.
