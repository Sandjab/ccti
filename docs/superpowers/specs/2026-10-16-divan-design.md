# Freudiff — spec de conception

Date : 2026-10-16 (nuit du 16 au 17). Auteur du brief : Jean-Paul Gavini. Rédaction : Claude.
Statut : validée en brainstorm (projet, forme, nom, ton, autorisations).

## 1. Résumé

**Freudiff** met votre binôme dev ↔ Claude Code sur le divan. C'est une page web
locale (GitHub Pages + fichier HTML autonome) dans laquelle on glisse son dossier
`~/.claude/projects`. Tout est analysé dans le navigateur, sans aucune requête
réseau. Le résultat : un **type de personnalité** parmi 16 (quatre axes mesurés),
des **compteurs drôles** (fois où Claude vous a donné raison, vos « non », vos
majuscules, vos rage-quits, vos nuits blanches), une **facture API équivalente**,
un **diagnostic mordant**, et une **carte SVG/PNG partageable**.

Tagline EN : *Put your Claude Code relationship on the couch.*
Tagline FR : *Allongez votre binôme Claude Code sur le divan.*

URL : `https://sandjab.github.io/freudiff` — dépôt public `Sandjab/freudiff`, licence MIT.

### Objectifs

1. Buzz et notoriété GitHub/X/LinkedIn/HN pour @Sandjab : mécanique de partage
   intégrée (on partage son type comme un test de personnalité).
2. Zéro installation, zéro infra, Mac/PC/Linux : rien à signer, rien à héberger.
3. Livrable en une nuit, avec tests, CI, déploiement et matériel de lancement.

### Non-objectifs (hors périmètre)

- Aucun upload, aucun classement, aucun compte, aucune télémétrie.
- Aucun appel LLM : le diagnostic est à base de règles (Rule 5 du CLAUDE.md global).
- Pas d'autres outils (Codex, Cursor, OpenCode) dans cette version.
- Pas de binaire natif, pas de CLI distribuée (le CLI Node est un outil interne de
  test et de calcul des chiffres de la démo).

### Différenciation vérifiée

Le créneau « stats Claude Code » est occupé (cc-wrapped, claude-code-wrapped,
vibestats, agentboard, claude-analytics, ccusage). Tous font des stats de
tokens/coût. Aucun ne fait de profil de personnalité, de compteurs relationnels
bilingues, ni de diagnostic humoristique. Freudiff ne concurrence pas ccusage sur la
facture : la facture est un chiffre parmi d'autres.

## 2. Parcours utilisateur

Page unique, trois états.

**État 1 — Accueil.**
- Titre, tagline, trois promesses en une ligne chacune : « Rien ne quitte votre
  machine (vérifiez l'onglet Réseau) », « Fonctionne hors ligne », « Code ouvert ».
- Zone de dépôt (drag & drop d'un dossier) + bouton « Choisir le dossier ».
  Sur Chrome/Edge : `showDirectoryPicker()`. Repli universel (Safari, Firefox) :
  `<input type="file" webkitdirectory>`.
- Aide « Où est mon dossier ? » : macOS `~/.claude/projects` (dans le sélecteur,
  `Cmd+Shift+.` affiche les dossiers cachés, ou `Cmd+Shift+G` et coller le
  chemin) ; Windows `%USERPROFILE%\.claude\projects` ; Linux `~/.claude/projects`.
- Bouton « Voir un exemple » : charge des stats synthétiques embarquées
  (`demo.js`) et affiche l'état 3. Les chiffres réels de Jean-Paul ne sont
  publiés qu'après sa validation (§ 12).
- Sélecteur de langue FR/EN (détection navigateur, mémorisée en localStorage dans
  un try/catch) et thème clair/sombre (préférence système, surcharge manuelle).

**État 2 — Analyse.**
- Barre de progression : fichiers traités / total, Mo lus, sessions trouvées,
  temps écoulé. Le travail est dans un Web Worker ; l'UI reste fluide.
- Bouton Annuler.
- Si aucun `.jsonl` n'est trouvé : message clair « Aucune session trouvée. Le
  dossier attendu est `~/.claude/projects` (il contient des sous-dossiers par
  projet avec des fichiers .jsonl) », retour à l'état 1.

**État 3 — Bilan.**
1. La **carte** (SVG) en haut, avec boutons : Télécharger PNG, Copier l'image,
   Télécharger le JSON (agrégats uniquement), Texte à partager (copie un texte
   prêt pour X/LinkedIn avec le type, deux chiffres et l'URL du site).
2. Le **diagnostic** : paragraphe du type + 3 à 5 observations déclenchées.
3. Les sections détaillées :
   - **Le couple** : Claude vous a donné raison, excuses de Claude, vos non, vos
     majuscules, vos jurons, vos mercis, interruptions, refus d'outil, questions
     posées par Claude / réponses, rage-quits, ratio de parole, patience.
   - **Les chiffres** : sessions, projets, messages, tours, appels d'outils (top
     10 outils), sous-agents délégués, jours actifs, série record, plus longue
     session, temps de travail cumulé de Claude.
   - **Les moments** : histogramme 24 h, histogramme 7 jours, part après 21 h,
     part après minuit, nuits blanches, heure la plus tardive.
   - **Le danger** : rm -rf, push --force, reset --hard, sudo, commits.
   - **La facture** : tokens par modèle (entrée, sortie, cache lu, cache écrit),
     coût API équivalent total et par modèle, disclaimer.
   - **Les modèles** : modèles rencontrés avec part des tours, versions de Claude
     Code traversées (première → dernière, nombre).
4. Pied : « Freudiff ne stocke rien, n'envoie rien. Code source : github.com/Sandjab/freudiff ».

## 3. Données d'entrée

### 3.1 Arborescence

```
~/.claude/projects/
  <slug-du-cwd>/                 # ex. -Users-jp-Documents-Dev-cartouche
    <sessionId>.jsonl            # session principale (humain ↔ Claude)
    <sessionId>/subagents/agent-<id>.jsonl   # sous-agents (Claude ↔ Claude)
    memory/*.md                  # ignoré
    <autres fichiers>            # ignorés
```

- **Session principale** : fichier `.jsonl` directement sous `<slug>/`.
- **Sous-agent** : fichier `.jsonl` sous `<slug>/<sessionId>/subagents/`. Tout
  autre `.jsonl` plus profond est traité comme sous-agent.
- Le **projet** d'une session = `basename(cwd)` de la première entrée qui porte un
  `cwd` ; à défaut, dernier segment du slug après le dernier `-`. Seuls les
  basenames sont conservés (jamais le chemin complet).
- Un sous-agent appartient à la session de son dossier parent ; il est **compté**
  (nombre de sous-agents, tokens, outils) mais **exclu des métriques humaines**
  (ses messages `user` sont écrits par Claude).

### 3.2 Format des lignes

Une entrée JSON par ligne. Champs communs : `type`, `uuid`, `parentUuid`,
`sessionId`, `timestamp` (ISO 8601 UTC), `cwd`, `version` (Claude Code),
`gitBranch`, `userType`, `isSidechain`, `isMeta`, `entrypoint`.

Types exploités :

| `type` | Champs utilisés | Usage |
|---|---|---|
| `user` | `message.content` (string ou tableau de blocs `text` / `tool_result` / `image`), `isMeta`, `isCompactSummary`, `timestamp` | messages humains, résultats d'outils (refus, interruptions, réponses aux questions) |
| `assistant` | `message.id`, `message.model`, `message.usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}`, `message.content` (blocs `text` / `tool_use` / `thinking`), `message.stop_reason`, `requestId`, `timestamp` | tours de Claude, outils, flatterie, excuses, facture |
| `permission-mode` | `permissionMode` | mode courant de la session (`default`, `acceptEdits`, `auto`, `bypassPermissions`, `plan`, `dontAsk`) |
| `system` avec `subtype: "turn_duration"` | `durationMs` | temps de travail cumulé de Claude |
| `system` avec `subtype: "model_refusal_fallback"` | présence | compteur « refus modèle avec repli » |

Tous les autres types (`summary`, `attachment`, `last-prompt`, `custom-title`,
`ai-title`, `mode`, `atis-latch`, `bridge-session`, `queue-operation`,
`file-history-*`, `agent-name`, `cost-state`, `pr-link`, `frame-link`, etc.) sont
ignorés. Une ligne non parsable est ignorée et comptée dans `corruptLines`.

**Dédoublonnage des tokens (obligatoire).** Un même tour assistant est écrit sur
plusieurs lignes (une par bloc de contenu) portant le même `message.id` et le même
`usage`. Correction du 17 oct. 2026 (revue finale, mesure sur le corpus complet) :
l'usage n'est **pas** toujours identique. Pendant le flux, `output_tokens` croît
d'une ligne à l'autre (première ligne souvent à `stop_reason: null`), et la
dernière porte le total. Le tour n'est compté **qu'une fois par `message.id`**
(clé `message.id + ':' + requestId` si `requestId` existe), avec, champ par champ,
la plus grande valeur d'usage vue pour cette clé. Les blocs `tool_use`
et `text` sont comptés sur chaque ligne (ce sont des blocs distincts). Un tour
assistant = un `message.id` distinct.

### 3.3 Message humain (définition normative)

Une entrée `user` est un **message humain** si et seulement si :
1. `isMeta` est faux et `isCompactSummary` est faux ;
2. `message.content` est une string, ou un tableau sans aucun bloc `tool_result` ;
3. après **nettoyage**, le texte est non vide.

Nettoyage d'un texte (appliqué à la string entière ou à chaque bloc `text`) :
supprimer les segments `<system-reminder>…</system-reminder>`,
`<pasted_content…>…</pasted_content>`, `<task-notification>…</task-notification>`,
`<local-command-stdout>…</local-command-stdout>`, `<local-command-caveat>…</local-command-caveat>`,
`<command-name>…</command-name>`, `<command-message>…</command-message>`,
`<command-args>…</command-args>`, `<bash-input>…</bash-input>`,
`<bash-stdout>…</bash-stdout>`, `<bash-stderr>…</bash-stderr>`,
`<local-command-stderr>…</local-command-stderr>` (mode bash « ! », adressé au
shell et non à Claude), les blocs de code ``` … ```, puis trim.
Un texte dont le reste commence par `[Request interrupted by user` n'est pas un
message humain : il est compté comme **interruption**.
Les messages contenant une commande slash (`<command-name>`) sont comptés dans
`slashCommands` (par nom) mais ne sont pas des messages humains.

**Longueur propre** = longueur du texte nettoyé. Elle sert à l'axe Verbeux/Laconique.

### 3.4 Horodatage

Les heures sont converties en heure locale du navigateur (ou du CLI) via
`new Date(ts)`. Les jours sont des jours locaux `YYYY-MM-DD`.

## 4. Métriques

Toutes les métriques sont des nombres, des listes de nombres, ou des noms courts
(modèle, outil, basename de projet, version). **Aucun texte de conversation n'est
conservé**, ni dans l'état mémoire, ni dans le JSON exporté. Un test l'impose
(§ 10).

### 4.1 Volume

- `sessions` : fichiers principaux avec ≥ 1 message humain. `ghostSessions` :
  fichiers principaux sans message humain.
- `projects` : basenames distincts (sessions non fantômes). `topProjects` : 10
  premiers par nombre de sessions (`{name, sessions}`).
- `humanMessages`, `assistantTurns` (message.id distincts), `toolCalls` total et
  `toolsByName` (top 15 ; le reste dans `other`).
- `subagents` : fichiers sous-agents ; `subagentTurns`.
- `activeDays` ; `firstDay`, `lastDay` ; `longestStreakDays` (jours locaux
  consécutifs avec ≥ 1 message humain).
- `longestSession` : `{humanMessages, durationMin, project}` (max messages humains).
- `claudeWorkMinutes` : Σ `durationMs` des `turn_duration` / 60 000 (sessions
  principales et sous-agents).
- `corruptLines`.

### 4.2 Moments

- `byHour[24]`, `byWeekday[7]` (0 = dimanche) : messages humains.
- `eveningShare` : part des messages humains entre 21:00 et 05:59.
- `afterMidnightShare` : part entre 00:00 et 05:59.
- `allNighters` : jours avec ≥ 3 messages humains entre 02:00 et 05:59.
- `latestHour` : `{hour, minute}` du message humain le plus tardif entre 00:00 et
  05:59 (sinon le plus tardif de la journée).

### 4.3 Le couple

Compteur = nombre de **blocs** (texte assistant ou message humain) qui
correspondent à au moins une regex de la liste (insensible à la casse, flag `i`,
et `m` quand `^` est utilisé). Un bloc compte 1 même s'il contient plusieurs
occurrences. Les `\b` ci-dessous sont implémentés par des lookarounds Unicode
(`(?<![\p{L}\p{N}])` … `(?![\p{L}\p{N}])`, flag `u`) car le `\b` natif de
JavaScript ignore les lettres accentuées (« désolé » ne matcherait pas).

**`claudeAgreed` — Claude vous a donné raison** (texte assistant) :
```
EN: /\byou'?re (absolutely |totally |completely |quite )?right\b/
    /\byou are (absolutely |completely )?(right|correct)\b/
    /\bgood catch\b/
    /\b(great|excellent|good|fair) (question|point)\b/
FR: /\b(vous avez|tu as|t'as) (tout à fait |entièrement |parfaitement |absolument |bien |complètement )?raison\b/
    /\bbien vu\b/
    /\b(bonne|excellente) (remarque|question|idée)\b/
    /\bc'est (tout à fait |parfaitement )?(juste|exact)\b/
    /^(exact|effectivement|tout à fait|absolument)[ .!,]/m
```
Sous-compteur `absolutelyRight` : `/you'?re absolutely right/` seul (le mème).

**`claudeApologized` — excuses de Claude** (texte assistant) :
```
EN: /\b(sorry|i apologi[sz]e|my apologies|apologies|my mistake|my bad|i was wrong)\b/
FR: /\b(désolé|désolée|je m'excuse|mes excuses|toutes mes excuses|pardon|mon erreur|je me suis trompé|au temps pour moi|autant pour moi)\b/
```

**`humanNo` — vous avez dit non** (message humain, texte nettoyé) :
```
/^\s*(non|no|nope|nan|stop|arrête|arrete|attends|wait|faux|wrong)\b/
/(pas ce que j'ai demandé|not what i asked|je t'ai (déjà )?dit|i (already )?told you|encore une fois|once again|c'est faux|that's wrong)/
```

**`humanCaps` — vous avez crié** : texte nettoyé de longueur ≥ 8, ≥ 4 lettres,
ratio majuscules / lettres ≥ 0,8.

**`humanSwear` — vous avez juré** :
```
/\b(putain|merde|bordel|fait chier|connerie|conneries|fuck|fucking|wtf|shit|damn|crap|bullshit)\b/
```

**`humanThanks` — vos mercis** :
```
/\b(merci|thanks|thank you|thx|bravo|parfait|nickel|génial|excellent|impeccable|great job|well done|awesome|perfect)\b/
```

**`humanDoubleMarks`** : `/!{2,}|\?{2,}/`.

**`interruptions`** : textes user contenant `[Request interrupted by user`
(avec ou sans ` for tool use]`). Sous-compteur `interruptionsForTool`.

**`toolDenials` — refus d'outil** : bloc `tool_result` contenant
`The user doesn't want to proceed with this tool use`.
**`autoModeBlocks`** : bloc `tool_result` contenant
`was denied by the Claude Code auto mode classifier`.

**`questionsAsked`** : blocs `tool_use` de nom `AskUserQuestion`.
**`questionsAnswered`** : `tool_result` dont le `tool_use_id` correspond à un
`AskUserQuestion` de la même session et qui ne contient pas
`doesn't want to proceed` (map `tool_use_id → name` par session, vidée en fin de
fichier).

**`rageQuits`** : sessions principales dont le **dernier** message humain
correspond à `humanNo`, `humanCaps` ou `humanSwear`.

**`talkRatio`** : Σ longueurs propres humaines / (Σ longueurs propres humaines +
Σ longueurs des blocs texte assistant), sessions principales. Affiché « vous
parlez X % du temps ».

**`patienceMedianSec`** : pour chaque message humain précédé d'un tour assistant
dans la même session, délai en secondes ; on ne retient que les délais < 3 600 s ;
médiane.

**`modelRefusalFallbacks`** : entrées `system` de subtype `model_refusal_fallback`.

### 4.4 Le danger (blocs `tool_use` de nom `Bash`, champ `input.command`)

- `rmRf` : `/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/`
- `forcePush` : `/git\s+push\b[^\n|;&]*(--force\b|-f\b|--force-with-lease\b)/`
- `resetHard` : `/git\s+reset\s+--hard\b/`
- `sudo` : `/\bsudo\b/`
- `gitCommits` : `/git\s+commit\b/`

Compte 1 par bloc `tool_use`. Sessions principales **et** sous-agents.

### 4.5 Contrôle

- `permissionModes` : messages humains par mode courant. Le mode courant d'une
  session est le dernier `permissionMode` vu **avant** le message ; `default` si
  aucun. Clés : `default`, `acceptEdits`, `auto`, `bypassPermissions`, `plan`,
  `dontAsk`, `other`.
- `plannedSessions` : sessions principales où l'on observe un `permission-mode`
  `plan`, **ou** un `tool_use` `EnterPlanMode`/`ExitPlanMode`, **ou** dont le
  premier message humain a une longueur propre ≥ 600.
- `slashCommands` : top 10 par nom.

### 4.6 La facture

Tokens par modèle (après dédoublonnage) : `input`, `output`, `cacheRead`,
`cacheWrite` (`cache_creation_input_tokens`), dont `cacheWrite1h`
(`cache_creation.ephemeral_1h_input_tokens`, facturé 2 × l'entrée ; le reste au
tarif 5 min). Sessions principales et sous-agents.

Grille USD par million de tokens (source : skill claude-api, table en cache du
2026-10-06, et grille publique pour les anciens modèles). Cache lu = 0,1 × entrée
sauf mention ; cache écrit = 1,25 × entrée (TTL 5 min).

| Préfixe de `model` | Entrée | Sortie | Cache lu | Cache écrit |
|---|---|---|---|---|
| `claude-fable-5-1`, `claude-mythos-5-1` | 10 | 50 | 0,25 | 12,5 |
| `claude-fable-5`, `claude-mythos-5` | 10 | 50 | 1,00 | 12,5 |
| `claude-opus-5-5` | 4 | 20 | 0,20 | 5 |
| `claude-opus-5` | 5 | 25 | 0,50 | 6,25 |
| `claude-opus-4-8`, `-4-7`, `-4-6`, `-4-5` | 5 | 25 | 0,50 | 6,25 |
| `claude-opus-4-1`, `claude-opus-4` (2025) | 15 | 75 | 1,50 | 18,75 |
| `claude-sonnet-5-5`, `claude-sonnet-5` | 2 | 10 | 0,20 | 2,5 |
| `claude-sonnet-4-6`, `-4-5`, `claude-sonnet-4` | 3 | 15 | 0,30 | 3,75 |
| `claude-haiku-5-5` | 0,10 | 0,50 | 0,01 | 0,125 |
| `claude-haiku-4-5` | 1 | 5 | 0,10 | 1,25 |
| `claude-haiku-3-5` | 0,80 | 4 | 0,08 | 1 |
| repli famille `opus` / `sonnet` / `haiku` | 5/3/1 | 25/15/5 | 0,5/0,3/0,1 | 6,25/3,75/1,25 |
| inconnu (ex. `<synthetic>`) | 0 | 0 | 0 | 0 → `unpricedTokens` |

La correspondance se fait par **préfixe le plus long**. `costUsd` total et par
modèle. Affichage avec le disclaimer : « Estimation au tarif API public ; votre
abonnement ne facture pas ainsi. »

### 4.7 Modèles et versions

- `models` : `{name, turns, share}` triés par tours.
- `versions` : `{first, last, count}` des `version` distinctes (tri sémantique).

## 5. Axes et types

Quatre axes, score 0–100, lettre selon le seuil.

| Axe | Lettres | Score | Seuil |
|---|---|---|---|
| Autonomie / Contrôle | **A** (Autonomie/Autonomy) vs **C** (Contrôle/Control) | `A = 70 × autoShare + 30 × (1 − min(1, 10 × frictionRate))` où `autoShare` = part des messages humains sous `auto`, `bypassPermissions`, `acceptEdits` ou `dontAsk` ; `frictionRate = (interruptions + toolDenials) / humanMessages` | A si score ≥ 50 |
| Verbeux / Laconique | **V** vs **L** | `V = min(100, medianCleanLength / 4)` (médiane 200 caractères = 50) | V si ≥ 50 |
| Planificateur / Impulsif | **P** vs **I** | `P = 100 × plannedSessions / sessions` | P si ≥ 33 |
| Nocturne / Diurne | **N** vs **D** | `N = 100 × eveningShare` | N si ≥ 35 |

Code de type = lettre axe 1 + axe 2 + axe 3 + axe 4, dans l'ordre (ex. `ALIN`).
Tout ratio dont le dénominateur est nul vaut 0 (`frictionRate`, `P`, `talkRatio`,
`share`), sans exception levée.
Si `humanMessages` < 20, le type est calculé quand même mais marqué
`lowConfidence` (bandeau « échantillon mince, verdict provisoire »).

### 5.1 Les 16 types (ton mordant : piquant, affectueux, jamais méprisant)

Chaque type a un nom FR/EN et trois phrases FR/EN. Les textes ci-dessous sont
**normatifs** : ils vont tels quels dans `src/i18n/fr.js` et `en.js`.

**CVPD — Le Contremaître / The Foreman**
FR : Vous écrivez des cahiers des charges à une machine qui lit dix mille mots à la seconde, puis vous relisez chaque ligne qu'elle produit. Ce n'est pas de la méfiance, c'est de la méthode. Vos projets finissent, et dans ce métier c'est déjà une excentricité.
EN : You write requirement documents for a machine that reads ten thousand words a second, then you proofread every line it produces. That's not distrust, that's method. Your projects actually ship, which in this trade already counts as eccentric.

**CVPN — Le Contremaître de nuit / The Night Foreman**
FR : Même rigueur que le Contremaître, mais après 21 h, quand les specs s'allongent et que la patience raccourcit. Vous planifiez tout, vous validez tout, vous dormez peu. Claude ne s'en plaint pas : il n'a pas de cernes.
EN : Same rigor as the Foreman, but after 9 pm, when specs get longer and patience gets shorter. You plan everything, you approve everything, you sleep little. Claude doesn't mind: it has no dark circles.

**CVID — Le Micro-manager bavard / The Chatty Micromanager**
FR : Pas de plan, mais des paragraphes. Vous expliquez, vous reprenez, vous précisez, vous refusez l'outil, vous ré-expliquez. Claude finit par comprendre ce que vous vouliez, souvent au troisième message. Vous appelez ça « itérer ».
EN : No plan, but paragraphs. You explain, you correct, you clarify, you deny the tool, you explain again. Claude eventually gets what you meant, usually by the third message. You call that "iterating".

**CVIN — Le Rédacteur insomniaque / The Insomniac Editor**
FR : Il est tard, vous écrivez long, vous improvisez, et vous surveillez chaque modification comme un correcteur d'épreuves. C'est épuisant pour vous ; pour Claude c'est juste un mardi. Allez vous coucher, le diff sera encore là demain.
EN : It's late, you write long, you improvise, and you watch every edit like a proofreader. Exhausting for you; for Claude it's just a Tuesday. Go to bed, the diff will still be there tomorrow.

**CLPD — Le Chirurgien / The Surgeon**
FR : Un plan validé, trois mots par message, chaque modification relue. Propre, froid, efficace. On n'ose pas vous demander comment vous allez, et Claude non plus.
EN : An approved plan, three words per message, every edit reviewed. Clean, cold, efficient. Nobody dares ask how you're doing, and neither does Claude.

**CLPN — Le Chirurgien de garde / The Night Surgeon**
FR : Le Chirurgien, version service de nuit. Mêmes gestes précis, même économie de mots, mais à des heures où les autres ont éteint. Vous opérez à froid sur du code chaud. Personne ne meurt, c'est l'essentiel.
EN : The Surgeon on night shift. Same precise gestures, same economy of words, at hours when everyone else has logged off. You operate cold on hot code. Nobody dies, which is the main thing.

**CLID — Le Tireur d'élite / The Sniper**
FR : Pas de plan, des ordres courts, et un œil sur chaque outil que Claude dégaine. Vous tirez, vous vérifiez, vous retirez. Précis, mais vous ne faites confiance à personne, et surtout pas à un modèle de langage. C'est sans doute sage.
EN : No plan, short orders, and an eye on every tool Claude draws. You shoot, you check, you shoot again. Precise, but you trust no one, least of all a language model. Probably wise.

**CLIN — Le Veilleur / The Night Watch**
FR : Vous êtes là à des heures indues, vous parlez peu, vous n'annoncez rien, et vous refusez tout ce qui vous semble louche. Claude travaille sous votre regard fixe, dans le silence. Vous feriez un très bon gardien de phare.
EN : You're there at ungodly hours, you say little, you announce nothing, and you reject anything that looks fishy. Claude works under your steady gaze, in silence. You'd make a fine lighthouse keeper.

**AVPD — L'Architecte / The Architect**
FR : Vous écrivez des specs, vous validez le plan, puis vous laissez faire. C'est le rêve de tout agent : un humain qui explique clairement et qui s'en va. Si tous les clients étaient comme vous, les consultants seraient au chômage.
EN : You write specs, approve the plan, then step back. Every agent's dream: a human who explains clearly and then leaves. If every client were like you, consultants would be out of work.

**AVPN — L'Architecte noctambule / The Night Architect**
FR : De grandes specs tapées à minuit, un plan, et Claude en mode auto jusqu'à l'aube. Vous découvrez le résultat au petit déjeuner, comme un chantier qu'on visite le lendemain. Généralement il tient debout.
EN : Long specs typed at midnight, a plan, and Claude in auto mode until dawn. You review the result over breakfast, like a construction site you visit the morning after. Usually it's still standing.

**AVID — Le Conteur / The Storyteller**
FR : Vous racontez votre vie à Claude, votre contexte, vos doutes, vos envies, et vous lui faites confiance pour en tirer du code. Pas de plan, beaucoup de prose. Étonnamment, ça marche. Ne changez rien, mais ne le dites à personne.
EN : You tell Claude your life story, your context, your doubts, your wishes, and you trust it to turn that into code. No plan, lots of prose. Surprisingly, it works. Don't change a thing, but don't tell anyone.

**AVIN — Le Somnambule bavard / The Chatty Sleepwalker**
FR : À deux heures du matin, vous écrivez des paragraphes entiers à une machine en mode auto, sans plan. Elle exécute. Vous ne relirez pas tout. Un jour on écrira un roman sur vous, et ce sera Claude qui l'écrira.
EN : At two in the morning you write whole paragraphs to a machine in auto mode, with no plan. It executes. You won't read it all back. Someday someone will write a novel about you, and it'll be Claude.

**ALPD — Le Commanditaire / The Commissioner**
FR : Un plan, un mot, un feu vert. Vous déléguez comme on signe un chèque : vite, et sans regarder le montant. Claude livre, vous validez, tout le monde rentre à l'heure. C'est presque suspect.
EN : A plan, one word, a green light. You delegate the way one signs a cheque: quickly, without looking at the amount. Claude delivers, you approve, everyone goes home on time. Almost suspicious.

**ALPN — Le Capitaine de nuit / The Night Captain**
FR : Vous fixez le cap, vous dites « vas-y », et vous laissez Claude tenir la barre jusqu'au matin. Peu de mots, un plan, une confiance absolue, des horaires de contrebandier. Le navire arrive. Parfois ailleurs.
EN : You set the course, say "go", and let Claude hold the wheel until morning. Few words, a plan, total trust, smuggler's hours. The ship arrives. Sometimes elsewhere.

**ALID — Le Joueur de YOLO / The YOLO Player**
FR : « vas-y », « ok », « continue ». Mode auto, zéro plan, zéro relecture. Vous vivez dangereusement, et votre historique git le sait. Jusqu'ici tout va bien, comme disait l'homme qui tombait du dixième étage.
EN : "go", "ok", "continue". Auto mode, no plan, no review. You live dangerously, and your git history knows it. So far so good, as the man said falling past the tenth floor.

**ALIN — Le Somnambule / The Sleepwalker**
FR : Il est deux heures du matin, vous tapez « ok », et vous laissez Claude en mode auto réécrire votre projet. Vous découvrirez le résultat au réveil. Ou pas. Les grandes œuvres se font la nuit, les grands incidents aussi.
EN : It's two in the morning, you type "ok", and you let Claude rewrite your project in auto mode. You'll see the result when you wake up. Or not. Great works happen at night; so do great incidents.

### 5.2 Observations (diagnostic à seuils)

Déclenchées en plus du paragraphe de type ; on affiche au plus 5, par ordre de
priorité ci-dessous (la première condition vraie l'emporte en cas de doublon de
thème). `{n}` est remplacé par la valeur formatée. Textes normatifs.

| id | Condition | FR | EN |
|---|---|---|---|
| `night` | `eveningShare ≥ 0.35` | {n} % de vos messages partent après 21 h. Claude ne dort jamais ; vous, en théorie, si. | {n}% of your messages go out after 9 pm. Claude never sleeps; you, in theory, do. |
| `midnight` | `afterMidnightShare ≥ 0.15` | {n} % après minuit. Ce n'est plus du travail, c'est une liaison. | {n}% after midnight. That's not work anymore, that's an affair. |
| `allnighters` | `allNighters ≥ 2` | {n} nuits blanches détectées. Le code écrit à 4 h du matin a une qualité particulière : il est encore là le lendemain pour vous juger. | {n} all-nighters detected. Code written at 4 am has a special quality: it's still there the next day to judge you. |
| `agreed` | `claudeAgreed / assistantTurns ≥ 0.02` et `claudeAgreed ≥ 10` | Claude vous a donné raison {n} fois. Soit vous avez toujours raison, soit il a compris comment on garde son poste. | Claude told you you were right {n} times. Either you're always right, or it has figured out how to keep its job. |
| `absolutely` | `absolutelyRight ≥ 5` | {n} « You're absolutely right ». Le mème est vivant, et il habite chez vous. | {n} "You're absolutely right". The meme is alive, and it lives at your place. |
| `apologies` | `claudeApologized ≥ 10` | Claude s'est excusé {n} fois. Il n'a pas de conscience, mais il a des réflexes. | Claude apologized {n} times. It has no conscience, but it has reflexes. |
| `no_gt_thanks` | `humanNo > humanThanks` | Vous dites non plus souvent que merci ({n}). Ce n'est pas un reproche. C'est un constat. Bon, c'est un reproche. | You say no more often than thanks ({n}). That's not a reproach. It's an observation. Fine, it's a reproach. |
| `thanks` | `humanThanks ≥ 3 × max(1, humanNo)` et `humanThanks ≥ 10` | Vous avez remercié une machine {n} fois. C'est attendrissant. Ou prudent, au cas où. | You thanked a machine {n} times. That's touching. Or prudent, just in case. |
| `caps` | `humanCaps ≥ 1` | {n} messages en majuscules. Claude ne lit pas plus fort, mais il a bien noté. | {n} messages in all caps. Claude doesn't read louder, but it took note. |
| `swear` | `humanSwear ≥ 1` | {n} jurons. On ne vous juge pas. On compte, c'est différent. | {n} swear words. We're not judging. We're counting, which is different. |
| `ragequit` | `rageQuits ≥ 2` | {n} sessions terminées sur un coup de sang. Claude est resté. Il reste toujours. | {n} sessions ended in a huff. Claude stayed. It always stays. |
| `interruptions` | `interruptions ≥ 10` | Vous lui avez coupé la parole {n} fois. Il ne se vexe pas. Il l'écrit juste quelque part. | You cut it off {n} times. It doesn't get offended. It just writes it down somewhere. |
| `denials` | `toolDenials ≥ 5` | {n} outils refusés. Vous lisez ce qu'on vous propose avant de cliquer. C'est devenu rare. | {n} tools denied. You read what you're offered before clicking. That's become rare. |
| `rmrf` | `rmRf ≥ 1` | {n} rm -rf. On espère que vous aviez une sauvegarde. Claude, lui, n'a aucun regret : il n'a pas de mémoire. | {n} rm -rf. We hope you had a backup. Claude has no regrets: it has no memory. |
| `forcepush` | `forcePush ≥ 1` | {n} push --force. Quelque part, un collègue a eu une mauvaise journée. | {n} force pushes. Somewhere, a colleague had a bad day. |
| `cost` | `costUsd ≥ 500` | Équivalent API : {n}. Votre abonnement est la meilleure affaire de votre vie, et Anthropic le sait. | API equivalent: {n}. Your subscription is the best deal of your life, and Anthropic knows it. |
| `streak` | `longestStreakDays ≥ 14` | {n} jours consécutifs. Une relation stable. Ou une dépendance. On vous laisse choisir le mot. | {n} consecutive days. A stable relationship. Or a dependency. We'll let you pick the word. |
| `projects` | `projects ≥ 30` | {n} projets. Vous ne terminez pas des projets, vous en commencez. | {n} projects. You don't finish projects, you start them. |
| `subagents` | `subagents ≥ 100` | {n} sous-agents délégués. Vous ne codez plus, vous managez des machines. Le futur, paraît-il. | {n} subagents delegated. You don't code anymore, you manage machines. The future, apparently. |
| `questions` | `questionsAsked ≥ 10` et `questionsAnswered < 0.7 × questionsAsked` | Claude vous a posé {n} questions. Vous avez répondu à une partie. L'autre attend encore. | Claude asked you {n} questions. You answered some. The rest are still waiting. |
| `models` | `models.length ≥ 4` | {n} modèles traversés. Opus, Sonnet, Fable… Vous n'êtes resté fidèle à personne. | {n} models over the period. Opus, Sonnet, Fable… You stayed loyal to no one. |
| `noplan` | `plannedSessions / sessions < 0.05` et `sessions ≥ 20` | Aucun plan, ou presque. Vous improvisez et Claude s'adapte. L'un de vous deux finira par craquer. | No plan, or close to it. You improvise and Claude adapts. One of you will eventually crack. |
| `patience` | `patienceMedianSec ≤ 20` | Vous répondez en {n} s en médiane. Vous ne lisez pas ses réponses. Lui non plus, d'ailleurs. | You reply in {n}s median. You don't read its answers. Neither does it, to be fair. |
| `work` | `claudeWorkMinutes ≥ 6000` | Claude a travaillé {n} heures pour vous. Sans pause, sans syndicat, sans ticket-restaurant. | Claude worked {n} hours for you. No breaks, no union, no lunch vouchers. |

Formats : pourcentages entiers, durées « 4 h 12 », coûts « 1 234 $ » (FR) / « $1,234 » (EN), nombres avec séparateur de milliers selon la langue. Le `{n}` est
inséré **déjà formaté avec son unité** (« 15 % », « 1 234 $ », « 4 h 12 »,
« 12 s ») ; les textes ne répètent donc pas l'unité.

## 6. La carte

- SVG `1200 × 630` (format OpenGraph/X), `viewBox` identique, polices système
  (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`), aucune
  ressource externe.
- Contenu : en-tête « FREUDIFF » + « bilan de couple dev ↔ Claude Code » ; nom du
  type en grand ; code à quatre lettres ; quatre jauges horizontales avec les
  deux pôles étiquetés (ex. « Contrôle ◀ ▶ Autonomie ») et un curseur au score ;
  trois chiffres : sessions, « Claude vous a donné raison », coût API équivalent ;
  période « 11 mai → 2 oct. 2026 » ; pied « sandjab.github.io/freudiff ».
- Deux thèmes (clair/sombre) via des variables passées au générateur, pas via
  CSS externe (le SVG doit être autonome une fois exporté).
- Export PNG : sérialiser le SVG → `data:` URL → `Image` → `canvas` 2× (2400 ×
  1260) → `toBlob('image/png')`. Copier : `navigator.clipboard.write` avec
  `ClipboardItem` si disponible, sinon message « téléchargez le PNG ».
- Texte à partager (FR/EN) : « Mon binôme Claude Code est passé sur le divan :
  je suis « {type} » ({code}). {sessions} sessions, Claude m'a donné raison {n}
  fois. Faites le test (rien ne quitte votre machine) : https://sandjab.github.io/freudiff ».

## 7. Architecture technique

HTML, CSS, JavaScript natif (ES2022, modules), **aucun framework, aucun bundler**.
Node 20+ pour les scripts et tests. Playwright en devDependency pour le e2e.

```
freudiff/
  index.html                 # page unique ; charge src/main.js en module
  src/
    analyzer.js              # pur, sans DOM : class Analyzer
    patterns.js              # toutes les regex du § 4 (exportées, testées)
    pricing.js               # grille § 4.6 + priceFor(model) + cost(usage, model)
    profile.js               # axes, code de type, observations (ids) § 5
    card.js                  # renderCard(stats, profile, {lang, theme}) → string SVG
    render.js                # DOM du bilan (sections § 2, état 3)
    i18n.js + i18n/fr.js + i18n/en.js       # UI, types, observations, formats (modules ES, pas de JSON importé)
    worker.js                # lecture des fichiers, Analyzer, progress/result
    main.js                  # états, picker, drag&drop, worker, exports, langue, thème
    styles.css
    demo.js                  # stats de démo synthétiques (bouton « Voir un exemple »)
  scripts/
    build.mjs                # inline CSS/JS/JSON → dist/freudiff.html (fichier unique)
    gen-fixtures.mjs         # génère tests/fixtures/projects/** (JSONL synthétiques)
    cli.mjs                  # node scripts/cli.mjs <dossier> [--json out] [--lang fr]
  tests/
    patterns.test.js, pricing.test.js, analyzer.test.js, profile.test.js, privacy.test.js
    e2e/freudiff.spec.js        # Playwright
    fixtures/                # généré, commité
  .github/workflows/ci.yml  # test → build → deploy Pages (sur main)
  README.md  README-fr.md  LICENSE  CHANGELOG.md  package.json  .gitignore
  docs/article-en.md  docs/article-fr.md  docs/launch-posts.md
```

### 7.1 Interface de l'analyseur (contrat)

```js
import { Analyzer } from './analyzer.js';
const a = new Analyzer();
a.beginFile({ project: 'cartouche', kind: 'main' | 'subagent', sessionId: '…' });
a.feedLine(line);        // une ligne JSONL (string), sans '\n'
a.endFile();             // clôt la session : rage-quit, longest, map tool_use
const stats = a.result(); // objet JSON sérialisable (schéma § 7.2)
```

Même module pour le Worker (navigateur) et le CLI (Node). Aucune dépendance.
`feedLine` ne doit jamais lever : une ligne invalide incrémente `corruptLines`.

Lecture dans le Worker : pour chaque `File`, `file.stream()` →
`TextDecoderStream` → découpage par `\n` (reste conservé entre chunks) →
`feedLine`. Pré-filtre : si la ligne ne contient aucune des sous-chaînes
`"type":"user"`, `"type":"assistant"`, `"type":"permission-mode"`,
`"type":"system"`, elle est ignorée sans `JSON.parse`. Progression envoyée toutes
les 50 ms au plus.

### 7.2 Schéma de `stats` (clés principales)

```
meta: { generatedAt, freudiffVersion, tz, lowConfidence }
volume: { sessions, ghostSessions, projects, topProjects[], humanMessages,
          assistantTurns, toolCalls, toolsByName{}, subagents, subagentTurns,
          activeDays, firstDay, lastDay, longestStreakDays,
          longestSession{humanMessages,durationMin,project}, claudeWorkMinutes,
          corruptLines, medianCleanLength }
moments: { byHour[24], byWeekday[7], eveningShare, afterMidnightShare,
           allNighters, latestHour{hour,minute} }
couple: { claudeAgreed, absolutelyRight, claudeApologized, humanNo, humanCaps,
          humanSwear, humanThanks, humanDoubleMarks, interruptions,
          interruptionsForTool, toolDenials, autoModeBlocks, questionsAsked,
          questionsAnswered, rageQuits, talkRatio, patienceMedianSec,
          modelRefusalFallbacks }
danger: { rmRf, forcePush, resetHard, sudo, gitCommits }
control: { permissionModes{}, plannedSessions, slashCommands{} }
bill: { byModel{ name: {input,output,cacheRead,cacheWrite,cacheWrite1h,turns,costUsd} }, costUsd,
        unpricedTokens }
models: [{name, turns, share}], versions: {first, last, count}
```

`computeProfile(stats) → { axes: {A, V, P, N}, code, observations: [{id, n}] }`.

### 7.3 Build et fichier autonome

`scripts/build.mjs` produit `dist/freudiff.html` : CSS inliné, modules concaténés en
un seul script (ordre topologique, sans import/export), JSON i18n et demo
inlinés, Worker créé à partir d'un `Blob` contenant le code de l'analyseur.
`dist/freudiff.html` est publié comme artefact de release et accessible depuis la
page (« Télécharger la version hors ligne »). Le site Pages sert `index.html` +
`src/` directement (modules ES natifs).

### 7.4 Internationalisation et thème

- `fr.js` / `en.js` (objets exportés par défaut) : toutes les chaînes UI, noms et
  textes des 16 types, observations, libellés des axes, unités. Clé manquante →
  clé affichée (test de parité des clés).
- Langue : `navigator.language` commence par `fr` → FR, sinon EN ; bouton de
  bascule ; mémorisation `localStorage` dans try/catch.
- Thème : `prefers-color-scheme`, surcharge manuelle `data-theme`, variables CSS
  sur `:root`, fond explicite sur `body`.

## 8. Confidentialité (engagements vérifiables)

1. Aucune requête réseau après le chargement de la page (test e2e : aucun
   `request` vers un hôte autre que l'origine de la page ; en mode fichier
   autonome, aucune requête du tout).
2. Aucun texte de conversation en mémoire au-delà de la ligne en cours ; le JSON
   exporté ne contient que des nombres et des noms courts (test `privacy.test.js`
   : aucune valeur string > 80 caractères, hors `meta.generatedAt` ; les noms
   d'outils MCP peuvent atteindre 60 caractères).
3. Les chemins ne sont jamais conservés : `basename` seulement.
4. Pas de cookie, pas d'analytics, pas de police distante.

## 9. Performance

- Cible : 1 Go/min minimum dans Chrome ; le corpus réel de référence en < 5 min sur
  un M3 Ultra ; mémoire bornée par le streaming (pas de `file.text()`).
- Node (CLI) mesuré en spike : 460 Mo/s sur 1 Go avec `JSON.parse` de chaque
  ligne ; ≈ 40 s sur le corpus de référence.
- Le pré-filtre par sous-chaîne (§ 7.1) évite de parser ~40 % des lignes.

## 10. Tests et critères de succès

**Unitaires (`node --test`)** :
- `patterns.test.js` : chaque regex du § 4 avec au moins 2 positifs et 2 négatifs
  FR/EN ; les faux positifs connus (« rejected » dans un fichier lu, « denied »
  d'un chemin interdit) ne déclenchent pas `toolDenials`.
- `pricing.test.js` : préfixe le plus long, replis par famille, inconnu → 0 et
  `unpricedTokens`, calcul sur un usage de référence (vérifié à la main).
- `analyzer.test.js` : sur les fixtures : dédoublonnage (2 lignes même
  `message.id` → 1 tour, tokens comptés une fois), message humain vs méta vs
  slash vs interruption, longueur propre (collage et bloc de code exclus),
  sous-agent exclu des métriques humaines mais facturé, rage-quit, streak,
  patience, modes de permission, ligne corrompue comptée.
- `profile.test.js` : les 16 codes atteignables avec des stats construites ; les
  seuils exacts ; `lowConfidence` ; observations triées et limitées à 5.
- `privacy.test.js` : sur le JSON produit par le CLI sur les fixtures, aucune
  string > 80 caractères hors `meta`, et aucune string contenant `/` ou `\\`
  (pas de chemin).
- `i18n` : mêmes clés dans `fr.js` et `en.js`.

**Fixtures** (`scripts/gen-fixtures.mjs`, déterministes, commitées) : ≥ 8
sessions couvrant session vide, session avec 2 sous-agents, lignes corrompues,
tours multi-lignes, tous les marqueurs FR et EN, les deux côtés de chaque axe,
modèles connus/inconnus, `turn_duration`, `AskUserQuestion` répondu et refusé.

**E2E (Playwright, Chromium)** : charge `index.html` via un serveur statique
local, `setInputFiles` du dossier fixtures sur l'input `webkitdirectory`, attend
la carte, vérifie le code de type attendu et un compteur connu, clique
« Télécharger PNG » → fichier > 10 ko, vérifie l'absence de requête externe,
bascule FR/EN et thème, bouton « Voir un exemple ».

**Vérification réelle (manuelle, par l'exécuteur)** : CLI sur
`~/.claude/projects` complet : termine, durée affichée, chiffres plausibles
(ordres de grandeur attendus dans `private/notes.md`) ; puis la page
dans Chrome avec le même dossier : même type, même total de sessions que le CLI,
durée < 5 min.

**Critères de succès du projet** :
1. `npm test` vert, e2e vert, CI verte sur `main`.
2. `https://sandjab.github.io/freudiff` répond et produit un bilan sur le dossier
   réel dans Chrome et Safari.
3. `dist/freudiff.html` ouvert en `file://` produit le même bilan sur les fixtures
   (lecture via l'input ; pas de `fetch`).
4. README EN/FR, article EN/FR, posts prêts ; capture de carte réelle validée par
   Jean-Paul avant inclusion.

## 11. CI/CD et déploiement

- `ci.yml` : sur push et PR : `npm ci`, `npm test`, `npx playwright install
  --with-deps chromium`, `npm run e2e`, `npm run build` ; sur `main` : déploiement
  GitHub Pages via `actions/upload-pages-artifact` + `actions/deploy-pages`
  (racine du dépôt, en excluant `tests/`, `node_modules/`, `docs/`), et
  `dist/freudiff.html` attaché comme artefact.
- Pages activé via `gh api` (`build_type: workflow`).
- `package.json` : `"type": "module"`, scripts `test`, `e2e`, `build`,
  `fixtures`, `cli`. Seule devDependency : `@playwright/test`.

## 12. Lancement

- **README.md / README-fr.md** (style cartouche : bandeau bilingue, badges, image
  de la carte en `<picture>` clair/sombre, « Why », « How it works », « Privacy »,
  « The 16 types » en tableau, « Run locally », « Development », licence).
- **Article** `docs/article-en.md` + `docs/article-fr.md`, titre de travail :
  *{sessions} sessions, {sizeGB} GB, six months: I put my Claude Code relationship on the
  couch* / *{sessions} sessions, {sizeGB} Go, six mois : mon binôme Claude Code sur le
  divan*. Structure : le constat (les outils comptent des tokens, personne ne
  compte les « non ») ; comment ça marche en trois phrases ; mes chiffres (type,
  les cinq compteurs les plus parlants, la facture, l'évolution par modèle) ; ce
  que ça dit, en deux paragraphes mordants ; comment faire le test ; ce que Freudiff
  ne fait pas (vie privée). Les chiffres réels sont insérés après validation.
- **`docs/launch-posts.md`** : Show HN (titre + deux paragraphes), X (3 variantes
  EN, 1 FR), LinkedIn FR (ton direct, structuré, amical, une pointe d'humour).
- Jean-Paul publie lui-même ; rien n'est posté par Claude.
- Les chiffres réels (CLI sur `~/.claude/projects`), la carte réelle et l'article
  rempli sont produits dans `private/` (gitignoré) et attendent la validation de
  Jean-Paul avant tout commit. Le README et la démo publiés utilisent des stats
  synthétiques (`demo.js`).

## 13. Risques et cas limites

| Risque | Réponse |
|---|---|
| Navigateur sans `showDirectoryPicker` (Safari, Firefox) | `input webkitdirectory` en repli, testé |
| Dossier caché invisible dans le sélecteur macOS | aide inline (`Cmd+Shift+.`, `Cmd+Shift+G`) |
| Fichier énorme (ligne de 5 Mo observée) | découpage par chunks, pas de limite de ligne |
| Lignes corrompues (fin de fichier tronquée) | ignorées, comptées, affichées si > 0 |
| Fuseau horaire | local du navigateur, mentionné dans le bilan |
| Tours multi-lignes | dédoublonnage par `message.id` (§ 3.2) |
| Faux positifs regex (« rejected » dans un fichier lu) | phrases exactes de Claude Code pour refus/interruption ; tests dédiés |
| Modèle inconnu | `unpricedTokens` affiché, coût partiel signalé |
| Très peu de messages | `lowConfidence`, bandeau |
| Export PNG bloqué (canvas tainted) | SVG sans ressource externe ; repli « télécharger le SVG » |
| Presse-papiers indisponible | message et repli téléchargement |
| Dossier glissé = `~/.claude` au lieu de `projects` | on cherche `projects/` à un niveau de profondeur avant d'abandonner |

## 14. Ordre de priorité si le temps manque

1. Analyseur + profil + carte + page fonctionnelle sur fixtures.
2. Tests unitaires et privacy.
3. Déploiement Pages + CI.
4. README EN/FR.
5. E2E Playwright.
6. Fichier autonome `dist/freudiff.html`.
7. Article, posts, démo avec chiffres réels.
8. Peaufinage visuel.

## 15. Décisions prises (journal)

- Page web locale plutôt que binaire Go : pas de Gatekeeper/SmartScreen, un lien
  suffit (validé).
- Nom **Freudiff** (17 oct. 2026), après Divan puis PsyClaude ; PsyClaude écarté
  pour la marque « Claude ». Le dépôt privé `Sandjab/surprise` est renommé
  `Sandjab/freudiff` et passe public à la mise en ligne. La métaphore « sur le
  divan » reste dans les textes.
- Docs publiques nettoyées avant le premier push : chemin local et chiffres réels
  déplacés dans `private/notes.md` (gitignoré).
- Ton **mordant** (validé).
- Aucun LLM, aucun réseau, aucun upload (brief + Rule 5).
- Sous-agents facturés mais exclus des métriques humaines (leurs prompts sont de Claude).
- Tokens dédoublonnés par `message.id` (mesuré : ×2 sinon).
- Le CLI Node reste un outil interne (tests, chiffres de la démo), non distribué.
- Changement de modèle d'exécution après le plan (demande de Jean-Paul).
