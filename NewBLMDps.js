module.exports = {BLMRotationDps, GcdCalc, BLMRotationDps_AFUI}
const fd = require('./Damage')

/*
Determine GCD length, accounting for LL.
TODO: Integrate research on 1/1000s precision for cast times greater than GCD. May need to account for FPS locking in more detail
*/
function GcdCalc(baseGCD, sps, llFlag, lvl) {
  const { sub, div } = fd.getLvlMod(lvl);
  //fixed GcdCalc from shanzhe
  let ceil = Math.ceil(((sub - sps) * 130) / div);
  let pts = Math.floor(baseGCD * (1000 + ceil));
  let time = Math.floor(((llFlag ? 85 : 100) * pts) / 1000) / 100;
  return time;
}


/**
 * Calculate the expected DPS of the BLM rotation given a set of stats and level.
 * Developed from Furst's BLM PPS Model. Main idea: it takes 30-2gcd time of ice/fire spells to generate t3 and xeno, since using them takes the total to 30s.
 */
function BLMRotationDps(WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus) {  

  const fastF3B3 = fd.ExpectedActionDamage(290, 0.7, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const coldB3 = fd.ExpectedActionDamage(290, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const B4 = fd.ExpectedActionDamage(300, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Xeno = fd.ExpectedActionDamage(890, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const AF1F3P = fd.ExpectedActionDamage(290, 1.4, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const F4 = fd.ExpectedActionDamage(300, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Desp = fd.ExpectedActionDamage(350, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Para = fd.ExpectedActionDamage(540, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const HT = fd.ExpectedActionDamage(150, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const HTDot = fd.ExpectedActionDamage(60, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, true);
  const FS = fd.ExpectedActionDamage(500, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const MFCd = 100;

  //Every 120 actual seconds we have used:
  //    mf = 1longGcd + 1despGcd + 2 casterTax
  //    4 xeno + amplify = 5 shortGcd
  //    4 thunder = 4 shortgcd + 4 (1-tprocNum)* casterTax
  //    leylines and 8 instant casts
  // which means it takes ((30/0.85 + 90) + 8*instantGain - 1longGcd - 9 shortGcd - 1 despGcd - (6 - 4 tProcNum) casterTax) of base (ice/fire) rotation to generate all this and spend 120 actual seconds

  const F4Rotation = fastF3B3 + B4 + AF1F3P + 2*Para + F4 * 6 + Desp + FS;
  const Gcd = GcdCalc(2.5, SpS, false, 100)

  const baseTime = 4*(13*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 Para F3p 6F4 Para Desp FS = 13 GCDs

  let cycleTime = (20/0.85 + 100) //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(9*Gcd) //Assume 6F4 + Para + Desp + FS, no F3p
  cycleTime += -5*Gcd //4 Xeno + 1 Amp
  cycleTime += -4*Gcd //4 thunder refresh

  const nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  const xenoD = nCycles*5*Xeno;
  const mfD = nCycles*(Para + F4 * 6 + Desp + FS); //not using the manafont F3p any longer
  const thunderD = nCycles*4*(HT + 10*HTDot); // T3p is not affected by sps scalar
  
  const coldB3D = nCycles*(coldB3 - fastF3B3)*3; //gain from making 3 B3 casts instant per each 2 minute cycle
  //Reasoning for this:
  //- We assume full flexibility on triplecast due to charges, this gives 2 cold B3 per 2min
  //- per 2min cycle slow sets spend 2.42*3*13 = 94.38s on std loop
  //  add in 9*2.42 for manafont and 9 GCDs for xeno+T3 and there is no time to generate an extra B3
  //- Fast sets can generate an extra B3 but run into swiftcast drift
  //- Assume that swiftcast lines up with B3 every minute or so effectively

  const damage = 4 * (F4Rotation) + xenoD + mfD + thunderD + coldB3D;
  const time = nCycles*120; 
  return damage/time; //dps = (dmg*cycleTime) / (baseTime*120sec)
}

/**
 * ISOLATE AF/UI LOOP FOR DEBUG PURPOSES
 */
function BLMRotationDps_AFUI(WD, JobMod, MainStat, Det, DH, Crit, Sps, lvl, eno, pbonus) {  

  const fastF3B3 = fd.ExpectedActionDamage(290, 0.7, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const coldB3 = fd.ExpectedActionDamage(290, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const B4 = fd.ExpectedActionDamage(300, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Xeno = fd.ExpectedActionDamage(890, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const AF1F3P = fd.ExpectedActionDamage(290, 1.4, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const F4 = fd.ExpectedActionDamage(300, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Desp = fd.ExpectedActionDamage(350, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const Para = fd.ExpectedActionDamage(540, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const HT = fd.ExpectedActionDamage(150, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const HTDot = fd.ExpectedActionDamage(60, 1, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, true);
  const FS = fd.ExpectedActionDamage(500, 1.8, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, false);
  const MFCd = 100;

  //Every 120 actual seconds we have used:
  //    mf = 1longGcd + 1despGcd + 2 casterTax
  //    4 xeno + amplify = 5 shortGcd
  //    4 thunder = 4 shortgcd + 4 (1-tprocNum)* casterTax
  //    leylines and 8 instant casts
  // which means it takes ((30/0.85 + 90) + 8*instantGain - 1longGcd - 9 shortGcd - 1 despGcd - (6 - 4 tProcNum) casterTax) of base (ice/fire) rotation to generate all this and spend 120 actual seconds

  let F4Rotation = fastF3B3 + B4 + AF1F3P + 2*Para + F4 * 6 + Desp + FS;
  let Gcd = GcdCalc(2.5, Sps, false, 100)

  let baseTime = 4*(13*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 Para F3p 6F4 Para Desp FS = 13 GCDs

  let cycleTime = (20/0.85 + 100) //20 seconds spent under LL
  // cycleTime += -(120/MFCd)*(9*Gcd) //Assume 6F4 + Para + Desp + FS, no F3p
  // cycleTime += -5*Gcd //4 Xeno + 1 Amp
  // cycleTime += -4*Gcd //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let damage = 4 * (F4Rotation);
  let time = nCycles*120; 
  return damage/time; //dps = (dmg*cycleTime) / (baseTime*120sec)
}