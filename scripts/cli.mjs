#!/usr/bin/env node
// scripts/cli.mjs — outil interne (tests, chiffres de la démo). Non distribué.
// node scripts/cli.mjs <dossier> [--json out.json] [--lang fr|en]
import { writeFile } from 'node:fs/promises';
import { analyzeDirectory } from './lib/walk.mjs';
import { computeProfile } from '../src/profile.js';
import { t, fmtN, fmtInt } from '../src/i18n.js';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--json' && args[args.indexOf(a) - 1] !== '--lang');
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
if (!dir) { console.error('usage: node scripts/cli.mjs <dossier> [--json out.json] [--lang fr|en]'); process.exit(2); }
const lang = opt('--lang') === 'fr' ? 'fr' : 'en';

const t0 = Date.now();
const { stats, files, bytes } = await analyzeDirectory(dir, ({ done, total, bytes: b }) => process.stderr.write(`\r${done}/${total} fichiers, ${(b / 1e6).toFixed(0)} Mo`));
process.stderr.write('\n');
const profile = computeProfile(stats);
const sec = (Date.now() - t0) / 1000;
const L = (k, v) => console.log(`${String(k).padEnd(26)} ${v}`);
L('type', `${t(lang, `types.${profile.code}.name`)} (${profile.code})`);
L('axes', JSON.stringify(profile.axes));
L('sessions', `${fmtInt(lang, stats.volume.sessions)} (+${stats.volume.ghostSessions} vides), ${stats.volume.projects} projets`);
L('messages humains', fmtInt(lang, stats.volume.humanMessages));
L('tours Claude', `${fmtInt(lang, stats.volume.assistantTurns)} (+${fmtInt(lang, stats.volume.subagentTurns)} en sous-agents, ${fmtInt(lang, stats.volume.subagents)} sous-agents)`);
L('période', `${stats.volume.firstDay} → ${stats.volume.lastDay}, ${stats.volume.activeDays} jours actifs`);
L('claude a donné raison', stats.couple.claudeAgreed);
L('équivalent API', fmtN(lang, 'usd', stats.bill.costUsd));
for (const o of profile.observations) L(`obs:${o.id}`, t(lang, `observations.${o.id}`, { n: fmtN(lang, o.fmt, o.n) }));
L('perf', `${files} fichiers, ${(bytes / 1e6).toFixed(0)} Mo en ${sec.toFixed(1)} s (${(bytes / 1e6 / Math.max(sec, 0.001)).toFixed(0)} Mo/s)`);
if (opt('--json')) {
  await writeFile(opt('--json'), JSON.stringify({ stats, profile }, null, 2));
  L('json', opt('--json'));
}
