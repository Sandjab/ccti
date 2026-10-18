// codex/main.js — point d'entrée de la page CXTI : la saveur Codex (spec CXTI § 3.2).
import { boot } from '../src/app.js';
import { applyCodexTexts } from './i18n.js';
import { classify, accept } from './files.js';
import { createWorker } from './worker-factory.js';
import DEMO_STATS from './demo.js';

applyCodexTexts();
boot({ accept, classify, createWorker, demo: DEMO_STATS, assetBase: '../', filePrefix: 'cxti' });
