# Freudiff

> 🇬🇧 **English** (you are here) · 🇫🇷 [Français](README-fr.md)

[![CI](https://github.com/Sandjab/freudiff/actions/workflows/ci.yml/badge.svg)](https://github.com/Sandjab/freudiff/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-sandjab.github.io%2Ffreudiff-1F4B3A)](https://sandjab.github.io/freudiff)

> **Put your Claude Code relationship on the couch.**
> Drop your `~/.claude/projects` folder on a page. Get a personality type, the counters nobody
> dares to keep, an API-equivalent bill, a diagnosis with teeth, and a card to share.
> Everything runs in your browser. Nothing is uploaded, ever.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/card-dark.png">
  <img src="assets/card-light.png" alt="A Freudiff session card: The Night Architect, four gauges, three numbers" width="100%">
</picture>

**Try it: [sandjab.github.io/freudiff](https://sandjab.github.io/freudiff)** — or download the
[offline version](https://sandjab.github.io/freudiff/freudiff.html), a single HTML file.

## Why

Every Claude Code stats tool counts tokens. None of them counts how many times you said *no*,
how often Claude told you that you were absolutely right, or how many sessions you ended in all
caps at 2 am. Freudiff does. It is a personality test for the pair you and Claude Code have become,
with a bill at the end because somebody has to say it.

## What you get

- **Your type**, one of sixteen, from four measured axes: Control / Autonomy, Laconic / Verbose,
  Impulsive / Planner, Diurnal / Nocturnal.
- **The couple**: times Claude said you were right (FR and EN, including the *You're absolutely
  right* meme), Claude's apologies, your *no*, your all-caps messages, your swear words, your
  thank-yous, interruptions, tools you denied, questions Claude asked and how many you answered,
  rage quits, your share of the conversation, your median reply time.
- **The numbers**: sessions, projects, messages, tool calls, subagents, active days, longest streak,
  longest session, Claude's total working time.
- **The moments**: messages by hour and weekday, after 9 pm, after midnight, all-nighters.
- **The danger**: `rm -rf`, `push --force`, `reset --hard`, `sudo`, commits.
- **The bill**: tokens per model and what it would have cost at public API prices, cache included.
- **A diagnosis** with up to five observations, and a 1200×630 card (PNG, clipboard) to share.

## The sixteen types

| Code | English | Français |
|---|---|---|
| CVPD | The Foreman | Le Contremaître |
| CVPN | The Night Foreman | Le Contremaître de nuit |
| CVID | The Chatty Micromanager | Le Micro-manager bavard |
| CVIN | The Insomniac Editor | Le Rédacteur insomniaque |
| CLPD | The Surgeon | Le Chirurgien |
| CLPN | The Night Surgeon | Le Chirurgien de garde |
| CLID | The Sniper | Le Tireur d'élite |
| CLIN | The Night Watch | Le Veilleur |
| AVPD | The Architect | L'Architecte |
| AVPN | The Night Architect | L'Architecte noctambule |
| AVID | The Storyteller | Le Conteur |
| AVIN | The Chatty Sleepwalker | Le Somnambule bavard |
| ALPD | The Commissioner | Le Commanditaire |
| ALPN | The Night Captain | Le Capitaine de nuit |
| ALID | The YOLO Player | Le Joueur de YOLO |
| ALIN | The Sleepwalker | Le Somnambule |

Letters, in order: **C**ontrol or **A**utonomy (permission modes, interruptions, denied tools),
**V**erbose or **L**aconic (median length of your prompts, pasted content excluded),
**P**lanner or **I**mpulsive (plan mode, or a first prompt over 600 characters),
**N**octurnal or **D**iurnal (share of your messages between 9 pm and 6 am, your time zone).

## Privacy, verifiably

- No request leaves the page after it loads. Open your browser's Network tab and watch nothing happen.
- Only counters are kept: no prompt, no answer, no file path. The exported JSON is numbers and short
  names (models, tools, project folder names). A test enforces it.
- No cookie, no analytics, no remote font. The offline file works with the network cable unplugged.
- Subagent transcripts are counted and billed, but never read as *your* messages: Claude wrote those prompts.

## How it works

The page reads every `.jsonl` under the folder you drop, in a Web Worker, line by line, and keeps
aggregates only. Tokens are deduplicated per assistant message (Claude Code writes one line per
content block, with the same usage repeated). Agreement, apology, refusal and interruption markers
are French and English regular expressions, listed in `src/patterns.js`. Prices come from the
public API grid in `src/pricing.js`; the bill is an estimate, your subscription does not work that way.

## Run locally

```bash
git clone https://github.com/Sandjab/freudiff && cd freudiff
npm install
npm test                 # unit tests, fixtures, privacy guard
npm run build            # dist/freudiff.html, the single-file version
npm run e2e              # Playwright, Chromium
node scripts/cli.mjs ~/.claude/projects --lang en   # same analysis from the terminal
```

Hours are computed in your local time zone. Markers are heuristics tuned on French and English
conversations; other languages will undercount. Claude Code only, for now.

## License

MIT. Made by [@Sandjab](https://github.com/Sandjab), with Claude on the other side of the couch.
