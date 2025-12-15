// BLM Traits
const maimAndMend = 1.3;


module.exports = {Damage, CalcCritDamage, CalcCritRate, CalcDHRate, CalcDetDamage, getLvlMod}

/**
 * Damage Formula
 * Find damage of an attack with given potency and character stats.
 * Party bonus is a percentage bonus to main stat (5% for 8 man raid)
 */
function Damage(Potency, WD, JobMod, MainStat, Det, Crit, DH, lvl, eno, pbonus) {
  const { main, sub, M, div } = getLvlMod(lvl);
  
  //Apply party bonus. Per Dia, value of DET is sensitive to party bonus due to damage formula order of operations
  MainStat_p = MainStat*(1 + (pbonus/100));

  let Damage = Math.floor(Potency * (WD + Math.floor(main * JobMod / 1000)) * (100 + Math.floor((MainStat_p - main) * M / main)) / 100);
  Damage = Math.floor(Damage * (1000 + Math.floor(140 * (Det - main) / div)) / 1000);
  Damage = Math.floor(Damage / 100);
  Damage = Math.floor(Damage * maimAndMend); //BLM traits
  Damage = Math.floor(Damage * eno); //BLM traits
  const CritDamage = Math.floor(Damage * (1000 * CalcCritDamage(Crit, sub, div)) / 1000);
  const DHDamage = Math.floor(Damage * 1250 / 1000);
  const CritDHDamage = Math.floor(CritDamage * 1250 / 1000);
  const CritRate = CalcCritRate(Crit, sub, div);
  const DHRate = CalcDHRate(DH, sub, div);
  const CritDHRate = CritRate * DHRate;
  const NormalRate = 1 - CritRate - DHRate + CritDHRate;
  return Damage * NormalRate + CritDamage * (CritRate - CritDHRate) + DHDamage * (DHRate - CritDHRate) + CritDHDamage * CritDHRate;
}
function CalcCritRate(Crit, base, div) { return Math.floor(50 + (200 * (Crit - base) / div)) / 1000; }
function CalcCritDamage(Crit, base, div) { return (1000 + Math.floor(200 * (Crit - base) / div + 400)) / 1000; }
function CalcDHRate(DH, base, div) { return Math.floor(550 * (DH - base) / div) / 1000; }
function CalcDetDamage(Det, base, div) { return (1000 + Math.floor(140 * (Det - base) / div)) / 1000; }
function getLvlMod(lvl) {
  let ret = {};
  switch(lvl) {
    case 70:
      ret.main = 292;
      ret.sub = 364;
      ret.M = 125;
      ret.div = 900;
      break;
    case 80:
      ret.main = 340;
      ret.sub = 380;
      ret.M = 165;
      ret.div = 1300;
      break;
    case 90:
      ret.main = 390;
      ret.sub = 400;
      ret.M = 195;
      ret.div = 1900;
      break;
    case 100:
      ret.main = 440;
      ret.sub = 420;
      ret.M = 237;
      ret.div = 2780;
    default:
      ret.main = 440;
      ret.sub = 420;
      ret.M = 237;
      ret.div = 2780;
      break;
  }
  return ret;
}