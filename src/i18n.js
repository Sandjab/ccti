// src/i18n.js — accès aux textes et formats (spec § 7.4).
import fr from './i18n/fr.js';
import en from './i18n/en.js';

export const LANGS = { fr, en };
const locale = (lang) => (lang === 'fr' ? 'fr-FR' : 'en-US');
const pad2 = (n) => String(n).padStart(2, '0');

export function detectLang(nav = globalThis.navigator) {
  try {
    const saved = globalThis.localStorage && localStorage.getItem('ccti.lang');
    if (saved && LANGS[saved]) return saved;
  } catch {}
  const l = (nav && nav.language) || 'en';
  return String(l).toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function t(lang, key, vars) {
  const dict = LANGS[lang] || en;
  const v = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
  if (v === undefined) return key;
  if (typeof v !== 'string' || !vars) return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function fmtInt(lang, n) { return new Intl.NumberFormat(locale(lang)).format(Math.round(n)); }
export function fmtPct(lang, x) { return fmtInt(lang, x * 100) + (lang === 'fr' ? ' %' : '%'); }
export function fmtUsd(lang, x) {
  const n = fmtInt(lang, x);
  return lang === 'fr' ? `${n} $` : `$${n}`;
}
export function fmtHours(lang, h) {
  const H = Math.floor(h), M = Math.round((h - H) * 60);
  return lang === 'fr' ? `${fmtInt(lang, H)} h ${pad2(M)}` : `${fmtInt(lang, H)}h ${pad2(M)}m`;
}
export function fmtMinutes(lang, min) {
  if (min < 60) return `${Math.round(min)} min`;
  return fmtHours(lang, min / 60);
}
export function fmtSec(lang, s) { return `${Math.round(s)} s`; }
export function fmtN(lang, fmt, n) {
  switch (fmt) {
    case 'pct': return fmtPct(lang, n);
    case 'usd': return fmtUsd(lang, n);
    case 'hours': return fmtHours(lang, n);
    case 'sec': return fmtSec(lang, n);
    default: return fmtInt(lang, n);
  }
}
export function fmtDay(lang, iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
