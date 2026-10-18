// src/worker.js — Web Worker : un analyseur par outil, Claude Code ou Codex (spec § 7.1 ; spec CCTI Claude+Codex § 3).
import { Analyzer, projectFromSlug } from './analyzer.js';
import { CodexAnalyzer } from '../codex/analyzer.js';
import { runWorker } from './worker-core.js';

runWorker({
  claude: { make: () => new Analyzer(), info: (it) => ({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId }) },
  codex: { make: () => new CodexAnalyzer(), info: (it) => ({ sessionId: it.sessionId }) },
});
