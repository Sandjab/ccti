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
