// codex/worker.js — Web Worker CXTI : la boucle commune avec l'analyseur Codex (spec CXTI § 3.3).
import { CodexAnalyzer } from './analyzer.js';
import { runWorker } from '../src/worker-core.js';

runWorker(() => new CodexAnalyzer(), (it) => ({ sessionId: it.sessionId }));
