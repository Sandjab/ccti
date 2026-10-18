// codex/i18n.js — textes CXTI (spec CXTI § 3.4) : les textes CCTI où Claude devient Codex,
// puis les clés réécrites à la main. applyCodexTexts() remplace LANGS.fr et LANGS.en, une fois, avant boot().
import { LANGS } from '../src/i18n.js';

function swap(v) {
  if (typeof v === 'string') return v.replace(/Claude Code/g, 'Codex').replace(/Claude/g, 'Codex').replace(/CCTI/g, 'CXTI');
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
    ui: {
      dropHint: 'Glissez ici le dossier ~/.codex/sessions',
      whereMac: 'macOS : ~/.codex/sessions. Dans le sélecteur, Cmd+Shift+. affiche les dossiers cachés, ou Cmd+Shift+G puis collez le chemin.',
      whereWin: "Windows : %USERPROFILE%\\.codex\\sessions, à coller dans la barre d'adresse du sélecteur.",
      whereLinux: 'Linux : ~/.codex/sessions (Ctrl+H affiche les dossiers cachés).',
      noFiles: 'Aucune session lisible. Le dossier attendu est ~/.codex/sessions, avec des fichiers rollout-*.jsonl. Les fichiers compressés .jsonl.zst se décompressent avec zstd -d.',
      shareFooter: 'Test de personnalité à 16 types pour Codex, calculé dans le navigateur, rien ne quitte la machine : https://sandjab.github.io/ccti/codex/',
      footer: "CXTI ne stocke rien et n'envoie rien. Les heures sont celles de votre fuseau ({tz}). Projet indépendant, sans lien avec OpenAI, Anthropic ni The Myers-Briggs Company.",
    },
    card: { subtitle: 'Codex Type Indicator', site: 'sandjab.github.io/ccti/codex' },
    axesHelp: {
      A: "Contrôle ou Autonomie. 70 % : la part de vos messages envoyés avec un réglage qui laisse Codex agir sans demander (approbation « never », avec ou sans danger-full-access) ; le réglage par défaut (on-request) compte en contrôle. 30 % : l'absence de friction, c'est-à-dire peu d'interruptions et de refus d'outils par message. Autonomie (A) à partir de {t}, sinon Contrôle (C). Votre score : {score}.",
    },
    labels: {
      questions: 'Questions posées par Codex',
      billDisclaimer: "Estimation au tarif API public d'OpenAI (contexte court), cache compris. Votre abonnement ne facture pas ainsi.",
      wasteNote: "Un gros contexte n'est pas du gaspillage en soi : il est repayé à chaque échange. /compact ou une nouvelle session allègent la note.",
      compressedSkipped: 'Sessions compressées ignorées (zstd -d pour les inclure)',
    },
  },
  en: {
    ui: {
      dropHint: 'Drop your ~/.codex/sessions folder here',
      whereMac: 'macOS: ~/.codex/sessions. In the picker, Cmd+Shift+. shows hidden folders, or Cmd+Shift+G and paste the path.',
      whereWin: "Windows: %USERPROFILE%\\.codex\\sessions, paste it in the picker's address bar.",
      whereLinux: 'Linux: ~/.codex/sessions (Ctrl+H shows hidden folders).',
      noFiles: 'No readable sessions. The expected folder is ~/.codex/sessions, containing rollout-*.jsonl files. Compressed .jsonl.zst files can be decompressed with zstd -d.',
      shareFooter: '16-type personality test for Codex, computed in the browser, nothing leaves your machine: https://sandjab.github.io/ccti/codex/',
      footer: 'CXTI stores nothing and sends nothing. Hours are in your time zone ({tz}). Independent project, affiliated with neither OpenAI, Anthropic nor The Myers-Briggs Company.',
    },
    card: { subtitle: 'Codex Type Indicator', site: 'sandjab.github.io/ccti/codex' },
    axesHelp: {
      A: 'Control or Autonomy. 70%: the share of your messages sent with a setting that lets Codex act without asking (approval "never", with or without danger-full-access); the default setting (on-request) counts as control. 30%: lack of friction, meaning few interruptions and tool denials per message. Autonomy (A) from {t}, otherwise Control (C). Your score: {score}.',
    },
    labels: {
      questions: 'Questions Codex asked',
      billDisclaimer: "Estimate at OpenAI's public API prices (short context), cache included. Your subscription does not bill this way.",
      wasteNote: 'A large context is not waste in itself: it is paid again on every exchange. /compact or a fresh session lighten the bill.',
      compressedSkipped: 'Compressed sessions skipped (zstd -d to include them)',
    },
  },
};

export function applyCodexTexts() {
  for (const lang of Object.keys(LANGS)) LANGS[lang] = merge(swap(LANGS[lang]), OVERRIDES[lang] || {});
}
