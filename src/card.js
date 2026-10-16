// src/card.js — carte SVG 1200×630 (spec § 6). Fonction pure, sans DOM, sans ressource externe.
import { t, fmtInt, fmtUsd, fmtDay } from './i18n.js';
import { THRESHOLDS } from './profile.js';

export const THEMES = {
  light: { bg: '#E6E9E2', card: '#F8F7F2', ink: '#17211C', muted: '#5C6760', rule: '#C3CAC0', accent: '#1F4B3A', brass: '#B8912E', onBrass: '#17211C' },
  dark: { bg: '#0F1A15', card: '#17241E', ink: '#EAE6DA', muted: '#9AA79E', rule: '#2E4036', accent: '#D8B256', brass: '#D8B256', onBrass: '#0F1A15' },
};
export const DISPLAY_FONT = "'American Typewriter', 'Courier Prime', 'Courier New', monospace";
export const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const X0 = 200, X1 = 540; // piste des jauges

function gauge(key, score, threshold, labels, y, c) {
  const w = X1 - X0;
  const kx = Math.round(X0 + (w * Math.max(0, Math.min(100, score))) / 100);
  const tx = Math.round(X0 + (w * threshold) / 100);
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const x = X0 + (w * i) / 10;
    return `<line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}" stroke="${c.rule}" stroke-width="1"/>`;
  }).join('');
  return `<text x="60" y="${y + 5}" font-size="16" fill="${c.muted}">${esc(labels.left)}</text>
<text x="660" y="${y + 5}" font-size="16" fill="${c.muted}" text-anchor="end">${esc(labels.right)}</text>
<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${c.rule}" stroke-width="2"/>${ticks}
<line x1="${tx}" y1="${y - 12}" x2="${tx}" y2="${y + 12}" stroke="${c.muted}" stroke-width="2" stroke-dasharray="3 3"/>
<circle cx="${kx}" cy="${y}" r="11" fill="${c.accent}" stroke="${c.card}" stroke-width="3"/>
<text x="${kx}" y="${y - 18}" font-family="${DISPLAY_FONT}" font-size="13" fill="${c.ink}" text-anchor="middle">${Math.round(score)}</text>`;
}

export function renderCard(stats, profile, { lang = 'en', theme = 'light' } = {}) {
  const c = THEMES[theme] || THEMES.light;
  const name = t(lang, `types.${profile.code}.name`);
  const v = stats.volume || {}, couple = stats.couple || {}, bill = stats.bill || {};
  const period = v.firstDay ? `${fmtDay(lang, v.firstDay)} – ${fmtDay(lang, v.lastDay)}` : '';
  const gauges = ['A', 'V', 'P', 'N']
    .map((k, i) => gauge(k, profile.axes[k], THRESHOLDS[k], t(lang, `axes.${k}`), 330 + i * 60, c)).join('\n');
  const nums = [
    [fmtInt(lang, v.sessions || 0), t(lang, 'card.sessions')],
    [fmtInt(lang, couple.claudeAgreed || 0), t(lang, 'card.agreed')],
    [fmtUsd(lang, bill.costUsd || 0), t(lang, 'card.cost')],
  ].map(([val, label], i) => `<text x="760" y="${322 + i * 96}" font-family="${DISPLAY_FONT}" font-size="46" font-weight="700" fill="${c.ink}">${esc(val)}</text>
<text x="760" y="${350 + i * 96}" font-size="16" fill="${c.muted}">${esc(label)}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="${BODY_FONT}">
<rect width="1200" height="630" fill="${c.bg}"/>
<rect x="28" y="28" width="1144" height="574" rx="4" fill="${c.card}" stroke="${c.rule}" stroke-width="2"/>
<line x1="28" y1="118" x2="1172" y2="118" stroke="${c.rule}" stroke-width="2"/>
<text x="60" y="84" font-family="${DISPLAY_FONT}" font-size="34" font-weight="700" fill="${c.ink}">FREUDIFF</text>
<text x="280" y="84" font-size="20" fill="${c.muted}">${esc(t(lang, 'card.subtitle'))}</text>
<text x="1140" y="84" font-size="18" fill="${c.muted}" text-anchor="end">${esc(period)}</text>
<text x="60" y="214" font-family="${DISPLAY_FONT}" font-size="54" font-weight="700" fill="${c.accent}">${esc(name)}</text>
<rect x="60" y="238" width="96" height="36" rx="6" fill="${c.brass}"/>
<text x="108" y="264" font-family="${DISPLAY_FONT}" font-size="22" font-weight="700" fill="${c.onBrass}" text-anchor="middle">${esc(profile.code)}</text>
${gauges}
<line x1="700" y1="290" x2="700" y2="540" stroke="${c.rule}" stroke-width="2"/>
${nums}
<line x1="28" y1="560" x2="1172" y2="560" stroke="${c.rule}" stroke-width="2"/>
<text x="60" y="590" font-size="16" fill="${c.muted}">${esc(t(lang, 'card.footer'))}</text>
<text x="1140" y="590" font-family="${DISPLAY_FONT}" font-size="16" fill="${c.muted}" text-anchor="end">${esc(t(lang, 'card.site'))}</text>
</svg>`;
}
