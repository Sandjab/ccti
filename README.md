# CCTI — Claude and Codex Type Indicator

> 🇬🇧 **English** (you are here) · 🇫🇷 [Français](README-fr.md)

[![CI](https://github.com/Sandjab/ccti/actions/workflows/ci.yml/badge.svg)](https://github.com/Sandjab/ccti/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-sandjab.github.io%2Fccti-1F4B3A)](https://sandjab.github.io/ccti)

> **You and Claude Code or Codex in four letters: a 16-type personality test, a pastiche of MBTI (Myers-Briggs Type Indicator).**
> Drop your `~/.claude/projects` or `~/.codex/sessions` folder on a page (or both: you get one report per tool). Four measured axes give you one of sixteen
> types, in the spirit of MBTI-style tests. You also get the counters nobody
> dares to keep, an API-equivalent bill, a diagnosis with teeth, and a card to share.
> Everything runs in your browser. Nothing is uploaded, ever.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/card-dark.png">
  <img src="assets/card-light.png" alt="A CCTI session card: The Night Architect, four gauges, three numbers" width="100%">
</picture>

**Try it: [sandjab.github.io/ccti](https://sandjab.github.io/ccti)** — or download the
[offline version](https://sandjab.github.io/ccti/ccti.html), a single HTML file.

<img src="assets/demo.gif" alt="Demo: the 16 types gallery, then the example report and its card" width="100%">

## Why

Every Claude Code stats tool counts tokens. None of them counts how many times you said *no*,
how often Claude told you that you were absolutely right, or how many sessions you ended in all
caps at 2 am. CCTI does. It is a personality test for the pair you and Claude Code have become,
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
- **A diagnosis** with up to five observations, and a 1200×900 card (PNG, clipboard) to share.

## The sixteen types

Four axes, two poles each, one letter per axis. CCTI is an independent project, affiliated with neither Anthropic, OpenAI nor The Myers-Briggs Company. Claude is a trademark of Anthropic; Codex is a trademark of OpenAI; MBTI and Myers-Briggs Type Indicator are trademarks of The Myers-Briggs Company.

<table>
  <tr><td><img src="assets/types/en/CVPD.webp" alt="CVPD" width="200"></td><td><img src="assets/types/en/CVPN.webp" alt="CVPN" width="200"></td><td><img src="assets/types/en/CVID.webp" alt="CVID" width="200"></td><td><img src="assets/types/en/CVIN.webp" alt="CVIN" width="200"></td></tr>
  <tr><td><img src="assets/types/en/CLPD.webp" alt="CLPD" width="200"></td><td><img src="assets/types/en/CLPN.webp" alt="CLPN" width="200"></td><td><img src="assets/types/en/CLID.webp" alt="CLID" width="200"></td><td><img src="assets/types/en/CLIN.webp" alt="CLIN" width="200"></td></tr>
  <tr><td><img src="assets/types/en/AVPD.webp" alt="AVPD" width="200"></td><td><img src="assets/types/en/AVPN.webp" alt="AVPN" width="200"></td><td><img src="assets/types/en/AVID.webp" alt="AVID" width="200"></td><td><img src="assets/types/en/AVIN.webp" alt="AVIN" width="200"></td></tr>
  <tr><td><img src="assets/types/en/ALPD.webp" alt="ALPD" width="200"></td><td><img src="assets/types/en/ALPN.webp" alt="ALPN" width="200"></td><td><img src="assets/types/en/ALID.webp" alt="ALID" width="200"></td><td><img src="assets/types/en/ALIN.webp" alt="ALIN" width="200"></td></tr>
</table>

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
Codex sessions (`rollout-*.jsonl`) are read by `codex/analyzer.js` and billed at OpenAI's public prices
(`codex/pricing.js`); compressed `.jsonl.zst` files are counted, not read.

## Run locally

```bash
git clone https://github.com/Sandjab/ccti && cd ccti
npm install
npm test                 # unit tests, fixtures, privacy guard
npm run build            # dist/ccti.html, the single-file version
npm run e2e              # Playwright, Chromium
node scripts/cli.mjs ~/.claude/projects --lang en   # same analysis from the terminal
```

Hours are computed in your local time zone. Markers are heuristics tuned on French and English
conversations; other languages will undercount.

## License

MIT. Made by [@Sandjab](https://github.com/Sandjab), with Claude Code.
