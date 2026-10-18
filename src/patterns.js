// src/patterns.js — toutes les regex de CCTI (spec § 4). Aucune dépendance.
// W() remplace le \b de la spec par des lookarounds Unicode : le \b natif de JS
// ignore les lettres accentuées (« désolé » ne matcherait pas en fin de mot).
const W = (src, flags = '') =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'iu' + flags);
// S() : ancré en début de texte (flag m : début de ligne).
const S = (src) => new RegExp(`^\\s*(?:${src})(?![\\p{L}\\p{N}])`, 'imu');

export const CLEAN_TAGS = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<pasted_content[^>]*>[\s\S]*?<\/pasted_content>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  // mode bash (« ! commande ») : la commande et sa sortie s'adressent au shell, pas à Claude
  /<bash-input>[\s\S]*?<\/bash-input>/g,
  /<bash-stdout>[\s\S]*?<\/bash-stdout>/g,
  /<bash-stderr>[\s\S]*?<\/bash-stderr>/g,
  /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g,
  /`{3}[\s\S]*?`{3}/g,   // blocs de code (écrit `{3} pour ne pas casser la fence Markdown du plan)
];

export function cleanText(text) {
  let t = String(text ?? '');
  for (const re of CLEAN_TAGS) t = t.replace(re, '');
  return t.trim();
}

export const INTERRUPTED = /\[Request interrupted by user/;
export const INTERRUPTED_FOR_TOOL = /\[Request interrupted by user for tool use\]/;
export const SLASH_COMMAND = /<command-name>([^<]+)<\/command-name>/;

export const CLAUDE_AGREED = [
  W("you'?re (?:absolutely |totally |completely |quite )?right"),
  W('you are (?:absolutely |completely )?(?:right|correct)'),
  W('good catch'),
  W('(?:great|excellent|good|fair) (?:question|point)'),
  W("(?:vous avez|tu as|t'as) (?:tout à fait |entièrement |parfaitement |absolument |bien |complètement )?raison"),
  W('bien vu'),
  W('(?:bonne|excellente) (?:remarque|question|idée)'),
  W("c'est (?:tout à fait |parfaitement )?(?:juste|exact)"),
  /^(?:exact|effectivement|tout à fait|absolument)[ .!,]/imu,
];
export const ABSOLUTELY_RIGHT = /you'?re absolutely right/i;

export const CLAUDE_APOLOGIZED = [
  W('sorry|i apologi[sz]e|my apologies|apologies|my mistake|my bad|i was wrong'),
  W("désolée?|je m'excuse|mes excuses|toutes mes excuses|pardon|mon erreur|je me suis trompée?|au temps pour moi|autant pour moi"),
];

export const HUMAN_NO = [
  S('non|no|nope|nan|stop|arrête|arrete|attends|wait|faux|wrong'),
  /(pas ce que j'ai demandé|not what i asked|je t'ai (?:déjà )?dit|i (?:already )?told you|encore une fois|once again|c'est faux|that's wrong)/iu,
];
export const HUMAN_SWEAR = [
  W('putain|merde|bordel|fait chier|conneries?|fuck|fucking|wtf|shit|damn|crap|bullshit'),
];
export const HUMAN_THANKS = [
  W('merci|thanks|thank you|thx|bravo|parfait|nickel|génial|excellent|impeccable|great job|well done|awesome|perfect'),
];
export const HUMAN_DOUBLE_MARKS = [/!{2,}|\?{2,}/];

export const TOOL_DENIED = /The user doesn't want to proceed with this tool use/;
export const AUTO_MODE_BLOCK = /was denied by the Claude Code auto mode classifier/;

// Options globales de git entre `git` et la sous-commande : -C <dossier>, -c <clé=valeur> (issue #8).
const GIT = String.raw`git(?:\s+-[Cc]\s+\S+)*\s+`;

export const DANGER = {
  rmRf: /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/i,
  forcePush: new RegExp(String.raw`${GIT}push\b[^\n|;&]*(?:--force\b|-f\b|--force-with-lease\b)`),
  resetHard: new RegExp(String.raw`${GIT}reset\s+--hard\b`),
  sudo: /\bsudo\b/,
  gitCommits: new RegExp(String.raw`${GIT}commit\b`),
};

export function matchesAny(list, text) {
  const t = String(text ?? '');
  return list.some((re) => re.test(t));
}

export function isCaps(text) {
  const t = String(text ?? '');
  if (t.length < 8) return false;
  const letters = t.match(/\p{L}/gu) || [];
  if (letters.length < 4) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length >= 0.8;
}
