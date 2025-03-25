module.exports = {BLMThunderPps}
const fd = require('./Damage')

function BLMThunderPps (sps, lvl) {
  switch(lvl) {
    case 70:
      return newBLMThunderPps70(sps);
    case 80:
      return newBLMThunderPps80(sps);
    case 90:
      return newBLMThunderPps90(sps);
    case 100:
      return newBLMThunderPps(sps);
    default:
      return newBLMThunderPps(sps); 
  }
}

/*
Determine Sps scalar for DOT damage*/
function SpsScalar(sps, lvl) {
  const { sub, div } = fd.getLvlMod(lvl);
  let S = ((1000+Math.floor(130*(sps-sub)/div))/1000);
  return S;
}

/*
Determine GCD length, accounting for LL.
TODO: Integrate research on 1/1000s precision for cast times greater than GCD. May need to account for FPS locking in more detail
*/
function GcdCalc(gcd, sps, llFlag, lvl) {
  const { sub, div } = fd.getLvlMod(lvl);
  let time = Math.floor(Math.floor(1000 * (llFlag ? 85 : 100)  * (Math.floor(gcd * (1000 - Math.floor(130 * (sps-sub) / div))/1000) / 1000)) / 1000)/100;
  return time;
}


/**
 * Developed from Furst's BLM PPS Model. Main idea: it takes 30-2gcd time of ice/fire spells to generate t3 and xeno, since using them takes the total to 30s.
 */

//Every 120 actual seconds we have used:
//    mf = 1longGcd + 1despGcd + 2 casterTax
//    4 xeno + amplify = 5 shortGcd
//    4 thunder = 4 shortgcd + 4 (1-tprocNum)* casterTax
//    leylines and 8 instant casts
// which means it takes ((30/0.85 + 90) + 8*instantGain - 1longGcd - 9 shortGcd - 1 despGcd - (6 - 4 tProcNum) casterTax) of base (ice/fire) rotation to generate all this and spend 120 actual seconds
function newBLMThunderPps_pre72(sps) {  
  let casterTax = 0.12; // 0.1 + 2/fps
  let fastF3B3 = 0.7*280;
  let B4 = 320;
  let Xeno = 880;
  let F3P = 1.8*280;
  let F4 = 1.8*320;
  let Desp = 1.8*350;
  let Para = 520;
  let HT = 150;
  let HTDot = 60;
  var FS = 1.8*400;
  let F4Rotation = fastF3B3 + B4 + F3P + 2*Para + F4 * 6 + Desp + FS;
  let MFCd = 100;

  let shortGcd = GcdCalc(2500, sps, false, 100)
  let longGcd = GcdCalc(2800, sps, false, 100)
  let flareGcd = GcdCalc(3000, sps, false, 100)
  let instantGain9 = (3*(flareGcd+casterTax-shortGcd) + 6*(longGcd+casterTax-shortGcd)); // assume triple on F4/F4/FS x2 + swift on 3xF4/1xFS
  //Limiting factor is the number of Flare Stars possible in 2min. May want to improve this
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc(2500,sps, false, 100),150) + Math.floor(100*0.5*GcdCalc(3500, sps, false, 100))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc(2500,sps, true, 100),150) + Math.floor(100*0.5*GcdCalc(3500, sps, true, 100))),0)/100
  // short gcds = 4 * (6; B4, 2* Para, 2* fastcast F3/B3, instant Desp)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (8; b4, 6F4, FS)

  let baseTime = 24 * shortGcd + 24 * longGcd + 4 * flareGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 32 * casterTax;

  let cycleTime = (30/0.85 + 90) + instantGain9
  cycleTime += -(120/MFCd)*(3 * shortGcd + 6 * longGcd + 1 * flareGcd + 7 * casterTax) //Manafont fire phase
  cycleTime += -5*shortGcd //4 Xeno + 1 Amp
  cycleTime += -4*shortGcd //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp + FS);
  let thunderP = nCycles*4*(HT + 10*SpsScalar(sps, 100)*HTDot); // T3p is not affected by sps scalar
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP;
  let time = nCycles*120; 
  return potency/time;
}

//using live letter estimated numbers for now
function newBLMThunderPps(sps) {  
  let fastF3B3 = 0.7*290;
  let coldB3 = 290;
  let B4 = 300;
  let Xeno = 890;
  let F3P = 1.8*290;
  let F4 = 1.8*300;
  let Desp = 1.8*350;
  let Para = 540;
  let HT = 150;
  let HTDot = 60;
  var FS = 1.8*500;
  let F4Rotation = fastF3B3 + B4 + F3P + 2*Para + F4 * 6 + Desp + FS;
  let MFCd = 100;

  let Gcd = GcdCalc(2500, sps, false, 100)
  
  // used to allow for clipping when weaving on fast F3 / B3 - do we still need to do this?
  // let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc(2500,sps, false, 100),150) + Math.floor(100*0.5*GcdCalc(3500, sps, false, 100))),0)/100
  // let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc(2500,sps, true, 100),150) + Math.floor(100*0.5*GcdCalc(3500, sps, true, 100))),0)/100

  let baseTime = 4*(13*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 Para F3p 6F4 Para Desp FS = 13 GCDs
  // baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL;

  let cycleTime = (20/0.85 + 100) //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(10*Gcd) //Assume 6F4 + Para + Desp + FS + F3p
  cycleTime += -5*Gcd //4 Xeno + 1 Amp
  cycleTime += -4*Gcd //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp + FS); //assume that we're still using the manafont F3p for now
  let thunderP = nCycles*4*(HT + 10*SpsScalar(sps, 100)*HTDot); // T3p is not affected by sps scalar
  let coldB3P = (coldB3 - fastF3B3)*3; //gain from making 3 B3 casts instant per 4 full standard lines
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP + coldB3P;
  let time = nCycles*120; 
  return potency/time;
}

//Level 90 damage model
function newBLMThunderPps90(sps) {  
  let casterTax = 0.12; // 0.1 + 2/fps
  let fastF3B3 = 0.7*280;
  let coldB3 = 290;
  let B4 = 320;
  let Xeno = 880;
  let F3P = 1.8*280;
  let F4 = 1.8*320;
  let Desp = 1.8*350;
  let Para = 520;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 + B4 + F3P + 2*Para + F4 * 6 + Desp;
  let MFCd = 100;

  let shortGcd = GcdCalc(2500, sps, false, 90)
  let longGcd = GcdCalc(2800, sps, false, 90)
  let despGcd = GcdCalc(3000, sps, false, 90)
  let instantGain8 = (3*(despGcd+casterTax-shortGcd) + 5*(longGcd+casterTax-shortGcd)); // say, 3 despairs 5 f4s being instant
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc(2500, sps, false, 90),150) + Math.floor(100*0.5*GcdCalc(3500, sps, false, 90))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc(2500, sps, true, 90),150) + Math.floor(100*0.5*GcdCalc(3500, sps, true, 90))),0)/100

  let baseTime = 20 * shortGcd + 24 * longGcd + 4 * despGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 32 * casterTax;
  
  let cycleTime = (30/0.85 + 90) + instantGain8
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 1 * despGcd + 7 * casterTax) //Manafont fire phase
  cycleTime += -9*shortGcd //4 Xeno + 1 Amp, 4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp);
  let thunderP = nCycles*4*(T3 + 10*SpsScalar(sps, 90)*T3Dot); // T3p is not affected by sps scalar
  let coldB3P = (coldB3 - fastF3B3)*3; //gain from making 3 B3 casts instant per 4 full standard lines
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP + coldB3P;
  let time = nCycles*120; 
  return potency/time;
}

//Level 80 damage model
function newBLMThunderPps80(sps) {  
  let casterTax = 0.12; // 0.1 + 2/fps
  let fastF3B3 = 0.7*280;
  let B4 = 320;
  let Xeno = 880;
  let F3P = 1.8*280;
  let F4 = 1.8*320;
  let Desp = 1.8*350;
  let F1 = 1.8*180;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 * 2 + B4 + F1 + F4 * 6 + Desp;
  let MFCd = 120;

  let fProcNum = 0.4;

  let shortGcd = GcdCalc(2500, sps, false, 80)
  let longGcd = GcdCalc(2800, sps, false, 80)
  let despGcd = GcdCalc(3000, sps, false, 80)
  let instantGain8 = (3*(despGcd+casterTax-shortGcd) + 5*(longGcd+casterTax-shortGcd)); // say, 3 despairs 5 f4s being instant
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc(2500,sps, false, 80),150) + Math.floor(100*0.5*GcdCalc(3500, sps, false, 80))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc(2500,sps, true, 80),150) + Math.floor(100*0.5*GcdCalc(3500, sps, true, 80))),0)/100
  // short gcds = 4 * (4; B4, 1* F1, 2* fastcast)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (9; B4, F1, 6F4, despair)
  let baseTime = 16 * shortGcd + 24 * longGcd + 4 * despGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 36 * casterTax;
  
  let cycleTime = (30/0.85 + 90) + instantGain8
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 1 * despGcd + 8 * casterTax) //Manafont fire phase
  cycleTime += -4*shortGcd //4 Xeno, no Amp
  cycleTime += -4*shortGcd //4 thunder refresh
  cycleTime += -fProcNum*shortGcd // AF3 F3p cast

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + F1 + F4 * 6 + Desp);
  let thunderP = nCycles*4*(T3 + 10*SpsScalar(sps, 80)*T3Dot); // T3p is not affected by sps scalar

  //F3 proc adds an extra fastF3B3 worth of potency with AF1 F3p
  //For now assume AF3 F3p
  let potency = 4 * (F4Rotation +  fProcNum * F3P) + xenoP + mfP + thunderP; 
  let time = nCycles*120; 
  return potency/time;
}

//Level 70 damage model
function newBLMThunderPps70(sps) {  
  let casterTax = 0.12; // 0.1 + 2/fps
  let fastF3B3 = 0.7*280;
  let B4 = 320;
  let Foul = 600;
  let F3P = 1.8*280;
  let F4 = 1.8*320;
  let F1 = 1.8*180;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 * 2 + B4 + F1 + F4 * 6 + Desp;
  let MFCd = 120;

  let fProcNum = 0.4;

  let shortGcd = GcdCalc(2500, sps, false, 70)
  let longGcd = GcdCalc(2800, sps, false, 70)
  let despGcd = GcdCalc(3000, sps, false, 70)
  let instantGain8 = 8*(longGcd+casterTax-shortGcd); // 8 f4s being instant
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc(2500,sps, false, 70),150) + Math.floor(100*0.5*GcdCalc(3500, sps, false, 70))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc(2500,sps, true, 70),150) + Math.floor(100*0.5*GcdCalc(3500, sps, true, 70))),0)/100
  // short gcds = 4 * (4; B4, 1* F1, 2* fastcast)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (9; B4, F1, 6F4, despair)
  let baseTime = 16 * shortGcd + 24 * longGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 32 * casterTax;
  
  let cycleTime = (30/0.85 + 90) + instantGain8
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 1 * despGcd + 7 * casterTax) //Manafont fire phase
  cycleTime += -4*(shortGcd + casterTax) //4 Foul hardcasts
  cycleTime += -4*shortGcd //4 thunder refresh
  cycleTime += -fProcNum*shortGcd // AF3 F3p cast

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*4*Foul;
  let mfP = nCycles*(F3P + F1 + F4 * 6 + Desp);
  let thunderP = nCycles*4*(T3 + 10*SpsScalar(sps, 70)*T3Dot); // T3p is not affected by sps scalar

  //F3 proc adds an extra fastF3B3 worth of potency with AF1 F3p
  //For now assume AF3 F3p
  let potency = 4 * (F4Rotation +  fProcNum * F3P) + xenoP + mfP + thunderP; 
  let time = nCycles*120; 
  return potency/time;
}