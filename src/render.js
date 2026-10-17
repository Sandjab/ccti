// src/render.js — DOM du bilan (spec § 2, état 3). Une seule teinte pour les barres (skill dataviz).
import { t, fmtInt, fmtPct, fmtUsd, fmtN, fmtDay, fmtMinutes } from './i18n.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const pad2 = (n) => String(n).padStart(2, '0');
const sep = (lang) => (lang === 'fr' ? ' : ' : ': ');

// Textes du diagnostic, partagés par l'affichage et le bouton « Copier le texte pour LinkedIn ».
export function diagnosisTexts(profile, lang) {
  return {
    name: `${t(lang, `types.${profile.code}.name`)} (${profile.code})`,
    text: t(lang, `types.${profile.code}.text`),
    items: profile.observations.map((o) => t(lang, `observations.${o.id}`, { n: fmtN(lang, o.fmt, o.n) })),
  };
}

// Illustration d'un type (assets/types/<lang>/<CODE>.webp). Absente du fichier hors ligne :
// en cas d'échec de chargement, l'image est masquée plutôt qu'affichée cassée.
export function typeImage(code, lang, attrs = {}) {
  const img = h('img', { alt: `${t(lang, `types.${code}.name`)} (${code})`, width: 800, height: 800, decoding: 'async', ...attrs });
  img.addEventListener('error', () => { img.style.display = 'none'; img.dispatchEvent(new Event('freudiff:missing', { bubbles: true })); });
  img.src = `assets/types/${lang}/${code}.webp`;
  return img;
}

export function renderDiagnosis(root, profile, lang) {
  const d = diagnosisTexts(profile, lang);
  root.replaceChildren(
    h('h2', { text: t(lang, 'ui.diagnosisTitle') }),
    typeImage(profile.code, lang, { class: 'type-illustration' }),
    h('p', { class: 'type-name', text: d.name }),
    h('p', { class: 'type-text', text: d.text }),
    h('ul', {}, d.items.map((x) => h('li', { text: x }))),
  );
}

function dl(rows) {
  return h('dl', {}, rows.filter(Boolean).map(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));
}
function section(title, ...content) { return h('section', { class: 'section' }, h('h2', { text: title }), ...content); }
const wide = (el) => { el.classList.add('wide'); return el; }; // occupe toute la largeur de la grille
function histogram(values, labels, titleOf) {
  const max = Math.max(1, ...values);
  return [
    h('div', { class: 'hist', role: 'img' }, values.map((v, i) => h('div', {
      class: 'bar', style: `height:${Math.max(2, Math.round((100 * v) / max))}%`, title: titleOf(i, v), 'aria-label': titleOf(i, v),
    }))),
    h('div', { class: 'hist-labels' }, labels.map((l) => h('span', { text: l }))),
  ];
}

export function renderGallery(root, lang) {
  root.replaceChildren(...Object.keys(t(lang, 'types')).map((code) => typeImage(code, lang, { loading: 'lazy' })));
}

export function renderSections(root, stats, lang) {
  const L = (k) => t(lang, `labels.${k}`);
  const S = sep(lang);
  const v = stats.volume, c = stats.couple, m = stats.moments, d = stats.danger, b = stats.bill;
  const weekdays = t(lang, 'labels.weekdays');
  const latest = m.latestHour ? `${pad2(m.latestHour.hour)}:${pad2(m.latestHour.minute)}` : '–';
  const toolRows = Object.entries(v.toolsByName).slice(0, 8).map(([k, n]) => [k, fmtInt(lang, n)]);
  const projRows = v.topProjects.slice(0, 5).map((p) => [p.name, fmtInt(lang, p.sessions)]);
  const billRows = Object.entries(b.byModel).sort((a, z) => z[1].costUsd - a[1].costUsd);
  root.replaceChildren(
    section(t(lang, 'sections.couple'), dl([
      [L('claudeAgreed'), fmtInt(lang, c.claudeAgreed)], [L('absolutelyRight'), fmtInt(lang, c.absolutelyRight)],
      [L('claudeApologized'), fmtInt(lang, c.claudeApologized)], [L('humanNo'), fmtInt(lang, c.humanNo)],
      [L('humanThanks'), fmtInt(lang, c.humanThanks)], [L('humanCaps'), fmtInt(lang, c.humanCaps)],
      [L('humanSwear'), fmtInt(lang, c.humanSwear)], [L('humanDoubleMarks'), fmtInt(lang, c.humanDoubleMarks)],
      [L('interruptions'), fmtInt(lang, c.interruptions)], [L('toolDenials'), fmtInt(lang, c.toolDenials)],
      [L('autoModeBlocks'), fmtInt(lang, c.autoModeBlocks)],
      [L('questions'), `${fmtInt(lang, c.questionsAsked)} / ${fmtInt(lang, c.questionsAnswered)}`],
      [L('rageQuits'), fmtInt(lang, c.rageQuits)], [L('talkRatio'), fmtPct(lang, c.talkRatio)],
      [L('patience'), fmtN(lang, 'sec', c.patienceMedianSec)],
      c.modelRefusalFallbacks ? [L('modelRefusalFallbacks'), fmtInt(lang, c.modelRefusalFallbacks)] : null,
    ])),
    section(t(lang, 'sections.numbers'), dl([
      [L('period'), `${fmtDay(lang, v.firstDay)} – ${fmtDay(lang, v.lastDay)}`],
      [L('sessions'), fmtInt(lang, v.sessions)], [L('ghostSessions'), fmtInt(lang, v.ghostSessions)],
      [L('projects'), fmtInt(lang, v.projects)], [L('humanMessages'), fmtInt(lang, v.humanMessages)],
      [L('assistantTurns'), fmtInt(lang, v.assistantTurns)], [L('toolCalls'), fmtInt(lang, v.toolCalls)],
      [L('subagents'), fmtInt(lang, v.subagents)], [L('activeDays'), fmtInt(lang, v.activeDays)],
      [L('streak'), fmtInt(lang, v.longestStreakDays)],
      [L('longestSession'), t(lang, 'labels.longestSessionValue', { n: fmtInt(lang, v.longestSession.humanMessages), duration: fmtMinutes(lang, v.longestSession.durationMin), project: v.longestSession.project })],
      [L('claudeWork'), fmtMinutes(lang, v.claudeWorkMinutes)],
      v.corruptLines ? [L('corrupt'), fmtInt(lang, v.corruptLines)] : null,
    ]), h('h3', { text: L('topTools') }), dl(toolRows), h('h3', { text: L('topProjects') }), dl(projRows)),
    section(t(lang, 'sections.moments'),
      h('h3', { text: L('byHour') }),
      ...histogram(m.byHour, m.byHour.map((_, i) => (i % 3 === 0 ? pad2(i) : '')), (i, n) => `${pad2(i)}:00 – ${fmtInt(lang, n)}`),
      h('h3', { text: L('byWeekday') }),
      ...histogram(m.byWeekday, weekdays, (i, n) => `${weekdays[i]} – ${fmtInt(lang, n)}`),
      dl([[L('evening'), fmtPct(lang, m.eveningShare)], [L('afterMidnight'), fmtPct(lang, m.afterMidnightShare)], [L('allNighters'), fmtInt(lang, m.allNighters)], [L('latest'), latest]])),
    section(t(lang, 'sections.danger'), dl([
      [L('rmRf'), fmtInt(lang, d.rmRf)], [L('forcePush'), fmtInt(lang, d.forcePush)], [L('resetHard'), fmtInt(lang, d.resetHard)],
      [L('sudo'), fmtInt(lang, d.sudo)], [L('gitCommits'), fmtInt(lang, d.gitCommits)],
    ])),
    section(t(lang, 'sections.models'),
      dl(stats.models.slice(0, 8).map((mo) => [mo.name, `${fmtInt(lang, mo.turns)} (${fmtPct(lang, mo.share)})`])),
      h('p', { text: `${L('versions')}${S}${t(lang, 'labels.versionsValue', { first: stats.versions.first || '–', last: stats.versions.last || '–', count: stats.versions.count })}` })),
    // gaspillage (spec § 4.7) : case libérée par la facture ; absent des anciens exports JSON
    ...(stats.waste ? [section(t(lang, 'sections.waste'), dl([
      [L('turnsOver150k'), `${fmtInt(lang, stats.waste.turnsOver150k)} (${fmtPct(lang, stats.waste.turnsOver150kShare)})`],
      [L('costOver150k'), `${fmtUsd(lang, stats.waste.costOver150kUsd)} (${fmtPct(lang, stats.waste.costOver150kShare)})`],
      [L('maxContext'), `${fmtInt(lang, stats.waste.maxContext)} ${L('tokens')}`],
      [L('compactions'), fmtInt(lang, stats.waste.compactions)],
      [L('cacheRebuilds'), fmtInt(lang, stats.waste.cacheRebuilds)],
      [L('cacheRebuildsShort'), fmtInt(lang, stats.waste.cacheRebuildsShortPause)],
      [L('cacheRebuildExcess'), fmtUsd(lang, stats.waste.cacheRebuildExcessUsd)],
    ]), h('p', { class: 'disclaimer', text: L('wasteNote') }))] : []),
    wide(section(t(lang, 'sections.bill'),
      h('p', { class: 'bill-total', text: `${L('billTotal')}${S}${fmtUsd(lang, b.costUsd)}` }),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['model', 'input', 'output', 'cacheRead', 'cacheWrite', 'cost'].map((k) => h('th', { text: L(k) })))),
        h('tbody', {}, billRows.map(([name, u]) => h('tr', {},
          h('td', { text: name }), h('td', { text: fmtInt(lang, u.input) }), h('td', { text: fmtInt(lang, u.output) }),
          h('td', { text: fmtInt(lang, u.cacheRead) }), h('td', { text: fmtInt(lang, u.cacheWrite) }), h('td', { text: fmtUsd(lang, u.costUsd) })))))),
      b.unpricedTokens ? h('p', { class: 'disclaimer', text: `${L('unpriced')}${S}${fmtInt(lang, b.unpricedTokens)}` }) : null,
      h('p', { class: 'disclaimer', text: L('billDisclaimer') }))),
  );
}
