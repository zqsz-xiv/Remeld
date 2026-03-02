'use strict';

const { parentPort, workerData } = require('worker_threads');
const { gearSetsChunk, foodList, params } = workerData;
const { lvl, eno, smeldVal, pbonus, logInterval } = params || {};

const fm = require('./FindMeldSets');
const fb = require('./FindBisSets');
const fp = require('./NewBLMPps');

fp.setLevelToSolve(lvl);

const bestBySps = new Map();
let processed = 0;

for (const serializedGearSet of gearSetsChunk) {
  const gearSet = fb.GearSet.deserialize(serializedGearSet);
  const melds = fm.findMeldSets(gearSet);
  for (const meld of melds) {
    for (const food of foodList) {
      const sps = fb.totalStats(gearSet, meld, food, 'SS', smeldVal);
      const mult = fb.setDamage(gearSet, meld, food, lvl, eno, smeldVal, pbonus);
      if (!bestBySps.has(sps) || bestBySps.get(sps).mult < mult) {
        bestBySps.set(sps, { sps, mult, gearSet, meld, food });
      }
    }
  }
  processed++;
  if (logInterval > 0 && processed % logInterval === 0) {
    parentPort.postMessage({ type: 'progress', processed });
  }
}

parentPort.postMessage({ type: 'done', results: Array.from(bestBySps.values()), processed });
