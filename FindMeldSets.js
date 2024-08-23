const BASE = 120;
const NOMELD = -1;

//import { CalcDetDamage, CalcDHRate, CalcCritDamage, CalcCritRate } from './Damage.js';

module.exports = {getDamageMultiplier, getFullDamageMultiplier, getMelds, findMeldSets}
const d = require('./Damage');

function getDamageMultiplier(meld, gearSetStats, lvl, smeldVal) {
  if (meld == NOMELD) return -1;
  //console.log(['Processing meld...', meld]);
  const det = gearSetStats[getStatNum('Det')] + smeldVal * getMelds(meld, 'Det');
  const dh = gearSetStats[getStatNum('DH')] + smeldVal * getMelds(meld, 'DH');
  const crit = gearSetStats[getStatNum('Crit')] + smeldVal * getMelds(meld, 'Crit');
  const { main, sub, M, div } = getLvlMod(lvl);
  var res = d.CalcDetDamage(det, main, div) * (1 + 0.25 * d.CalcDHRate(dh, sub, div)) * (1 + (d.CalcCritDamage(crit, sub, div) - 1) * d.CalcCritRate(crit, sub, div));
  //console.log([det,dh,crit, "=>", res]);
  return res;
}
function getFullDamageMultiplier(meld, gearSetStats, lvl, int, wd, smeldVal) {
  if (meld == NOMELD) return -1;
  //console.log(['Processing meld...', meld]);
  const det = gearSetStats[getStatNum('Det')] + smeldVal * getMelds(meld, 'Det');
  const dh = gearSetStats[getStatNum('DH')] + smeldVal * getMelds(meld, 'DH');
  const crit = gearSetStats[getStatNum('Crit')] + smeldVal * getMelds(meld, 'Crit');

  const { main, sub, M, div } = getLvlMod(lvl);
  const TESTPOTENCY = 500;
  var res = Math.floor(TESTPOTENCY * (wd + Math.floor(main * BLM_JOBMOD / 1000)) * (100 + Math.floor((int - main) * M / main)) / 100);
  res *= d.CalcDetDamage(det, main, div) * (1 + 0.25 * d.CalcDHRate(dh, sub, div)) * (1 + (d.CalcCritDamage(crit, sub, div) - 1) * d.CalcCritRate(crit, sub, div));

  return res;
}
function getMelds(meld, stat) {
  return (Math.floor(meld / Math.pow(BASE, getStatNum(stat))) % BASE);
}
function findMeldSets(gearSet) {
  //console.log(gearSet.pieces);
  //console.log(gearSet.meldSlots);
  //console.log(gearSet.stats);
  var melds = new Set();
  var nextMelds = new Set();
  melds.add(0);
  //logSet(melds);
  gearSet.pieceMeldConfigs.forEach(meldConfigs => {
    //console.log('Applying meld...');
    meldConfigs.forEach(meldConfig => {
      var meldCode = 0;
      for (let i = 0; i < 4; i++) {
        meldCode += meldConfig[i] * Math.pow(BASE, i);
      }
      melds.forEach(meld => {
        nextMelds.add(meld + meldCode);
      });
    });
    melds = nextMelds;
    nextMelds = new Set();
    //console.log('Number of total new melds: ' + melds.size);
  });
  return melds;
}
function logSet(s) {
  console.log('Set entries:');
  s.forEach(i => console.log(i));
}

function getStatNum(stat){
  switch(stat){
    case 'Det':
      return 0;
    case 'DH':
      return 1;
    case 'Crit':
      return 2;
    case 'SS':
    default:
      return 3; 
  }
}
