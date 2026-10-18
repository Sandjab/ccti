// codex/pricing.js — grille OpenAI, USD par million de tokens (spec CXTI § 4.4).
// Source : developers.openai.com/api/docs/pricing et pages modèles, relevé du 2026-10-18.
// Tarif court contexte (≤ 272K tokens) seulement.
export const PRICES = [
  // [préfixe, entrée, entrée en cache, écriture en cache, sortie]
  ['gpt-6-astra', 10, 1, 12.5, 50],
  ['gpt-6.1-sol', 2, 0.1, 2.5, 10],
  ['gpt-6-sol', 2, 0.2, 2.5, 10],
  ['gpt-6-luna', 0.1, 0.01, 0.125, 0.5],
  ['gpt-5.6-sol', 4, 0.4, 5, 20],
  ['gpt-5.6-terra', 2, 0.2, 2.5, 12],
  ['gpt-5.6-luna', 0.2, 0.02, 0.25, 1.2],
  ['gpt-5.5', 5, 0.5, 0, 30],
  ['gpt-5.4', 2.5, 0.25, 0, 15],
  ['gpt-5.3-codex', 1.75, 0.175, 0, 14],
  ['gpt-5.2', 1.75, 0.175, 0, 14],
  ['gpt-5.1-codex-mini', 0.25, 0.025, 0, 2],
  ['gpt-5.1', 1.25, 0.125, 0, 10],
  ['gpt-5', 1.25, 0.125, 0, 10],
  ['codex-mini-latest', 1.5, 0.375, 0, 6],
  ['o4-mini', 1.1, 0.275, 0, 4.4],
  ['o3', 2, 0.5, 0, 8],
];

// Un préfixe couvre le nom exact ou ses variantes « préfixe-… » (gpt-5.2 → gpt-5.2-codex),
// jamais « gpt-5 » → « gpt-5.7 », ni une variante -mini, -nano ou -pro, qui a son propre prix :
// un modèle inconnu reste non tarifé. Le plus long gagne.
export function priceFor(model) {
  const m = String(model ?? '').toLowerCase();
  let best = null;
  for (const p of PRICES) {
    const variant = m.startsWith(p[0] + '-') && !/-(?:mini|nano|pro)(?:-|$)/.test(m.slice(p[0].length));
    if ((m === p[0] || variant) && (!best || p[0].length > best[0].length)) best = p;
  }
  // sans prix d'écriture en cache publié, OpenAI facture l'écriture au tarif d'entrée
  return best ? { input: best[1], cacheRead: best[2], cacheWrite: best[3] || best[1], output: best[4] } : null;
}

export function costUsd(usage, model) {
  const p = priceFor(model);
  if (!p) return null;
  const u = usage || {};
  return ((u.input || 0) * p.input + (u.cacheRead || 0) * p.cacheRead + (u.cacheWrite || 0) * p.cacheWrite + (u.output || 0) * p.output) / 1e6;
}
