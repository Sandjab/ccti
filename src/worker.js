// src/worker.js — Web Worker CCTI : la boucle commune avec l'analyseur Claude Code (spec § 7.1).
import { Analyzer, projectFromSlug } from './analyzer.js';
import { runWorker } from './worker-core.js';

runWorker(() => new Analyzer(), (it) => ({ project: projectFromSlug(it.slug), kind: it.kind, sessionId: it.sessionId }));
