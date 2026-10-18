// src/main.js — point d'entrée de la page CCTI : la saveur Claude Code (spec CXTI § 3.2).
import { boot } from './app.js';
import { classify } from './files.js';
import { createWorker } from './worker-factory.js';
import DEMO_STATS from './demo.js';

boot({ accept: (name) => name.endsWith('.jsonl'), classify, createWorker, demo: DEMO_STATS, assetBase: '', filePrefix: 'ccti' });
