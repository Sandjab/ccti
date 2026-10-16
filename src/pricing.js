// src/pricing.js — grille USD par million de tokens (spec § 4.6).
// Source : skill claude-api (table en cache du 2026-10-06) + grille publique pour les anciens modèles.
// Cache lu = 0,1 × entrée sauf mention ; cache écrit = 1,25 × entrée (TTL 5 min).
export const PRICES = [
  // [préfixe, entrée, sortie, cache lu, cache écrit] — le préfixe le plus long gagne
  ['claude-fable-5-1', 10, 50, 0.25, 12.5],
  ['claude-mythos-5-1', 10, 50, 0.25, 12.5],
  ['claude-fable-5', 10, 50, 1.0, 12.5],
  ['claude-mythos-5', 10, 50, 1.0, 12.5],
  ['claude-opus-5-5', 4, 20, 0.2, 5],
  ['claude-opus-5', 5, 25, 0.5, 6.25],
  ['claude-opus-4-8', 5, 25, 0.5, 6.25],
  ['claude-opus-4-7', 5, 25, 0.5, 6.25],
  ['claude-opus-4-6', 5, 25, 0.5, 6.25],
  ['claude-opus-4-5', 5, 25, 0.5, 6.25],
  ['claude-opus-4-1', 15, 75, 1.5, 18.75],
  ['claude-opus-4', 15, 75, 1.5, 18.75],
  ['claude-sonnet-5-5', 2, 10, 0.2, 2.5],
  ['claude-sonnet-5', 2, 10, 0.2, 2.5],
  ['claude-sonnet-4-6', 3, 15, 0.3, 3.75],
  ['claude-sonnet-4-5', 3, 15, 0.3, 3.75],
  ['claude-sonnet-4', 3, 15, 0.3, 3.75],
  ['claude-haiku-5-5', 0.1, 0.5, 0.01, 0.125],
  ['claude-haiku-4-5', 1, 5, 0.1, 1.25],
  ['claude-haiku-3-5', 0.8, 4, 0.08, 1],
  // replis par famille (préfixe court, donc perdant face aux lignes ci-dessus)
  ['claude-opus', 5, 25, 0.5, 6.25],
  ['claude-sonnet', 3, 15, 0.3, 3.75],
  ['claude-haiku', 1, 5, 0.1, 1.25],
];
const FAMILY = [['opus', 'claude-opus'], ['sonnet', 'claude-sonnet'], ['haiku', 'claude-haiku']];

function row(prefix) {
  const r = PRICES.find((p) => p[0] === prefix);
  return { input: r[1], output: r[2], cacheRead: r[3], cacheWrite: r[4] };
}

export function priceFor(model) {
  const m = String(model ?? '').toLowerCase();
  if (!m) return null;
  let best = null;
  for (const p of PRICES) if (m.startsWith(p[0]) && (!best || p[0].length > best[0].length)) best = p;
  if (best) return row(best[0]);
  for (const [needle, prefix] of FAMILY) if (m.includes(needle)) return row(prefix);
  return null;
}

export function costUsd(usage, model) {
  const p = priceFor(model);
  if (!p) return null;
  const u = usage || {};
  // cacheWrite = total des écritures ; cacheWrite1h = la part en TTL 1 h, facturée 2 × l'entrée.
  const w1h = Math.min(u.cacheWrite1h || 0, u.cacheWrite || 0);
  return ((u.input || 0) * p.input + (u.output || 0) * p.output
    + (u.cacheRead || 0) * p.cacheRead + ((u.cacheWrite || 0) - w1h) * p.cacheWrite + w1h * p.input * 2) / 1e6;
}
