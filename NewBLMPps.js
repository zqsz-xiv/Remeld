module.exports = {BLMThunderPps, SpsScalar, GcdCalc}
const fd = require('./Damage')

/**
 * Find the potency per second (pps) of the ideal rotation at a given level and spell speed.
 */
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
function GcdCalc(baseGCD, sps, llFlag, lvl) {
  const { sub, div } = fd.getLvlMod(lvl);
  //fixed GcdCalc from shanzhe
  let ceil = Math.ceil(((sub - sps) * 130) / div);
  let pts = Math.floor(baseGCD * (1000 + ceil));
  let time = Math.floor(((llFlag ? 85 : 100) * pts) / 1000) / 100;
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

  let shortGcd = GcdCalc(2.5, sps, false, 100)
  let longGcd = GcdCalc(2.8, sps, false, 100)
  let flareGcd = GcdCalc(3.0, sps, false, 100)
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
/**
 * Developed from Furst's BLM PPS Model. Main idea: it takes 30-2gcd time of ice/fire spells to generate t3 and xeno, since using them takes the total to 30s.
 */
//new model for 7.2 rework
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

  let Gcd = GcdCalc(2.5, sps, false, 100)

  let baseTime = 4*(13*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 Para F3p 6F4 Para Desp FS = 13 GCDs

  let cycleTime = (20/0.85 + 100) //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(9*Gcd) //Assume 6F4 + Para + Desp + FS, no F3p
  cycleTime += -5*Gcd //4 Xeno + 1 Amp
  cycleTime += -4*Gcd //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(Para + F4 * 6 + Desp + FS); //not using the manafont F3p any longer
  let thunderP = nCycles*4*(HT + 10*SpsScalar(sps, 100)*HTDot); // T3p is not affected by sps scalar
  
  let coldB3P = nCycles*(coldB3 - fastF3B3)*3; //gain from making 3 B3 casts instant per each 2 minute cycle
  //Reasoning for this:
  //- We assume full flexibility on triplecast due to charges, this gives 2 cold B3 per 2min
  //- per 2min cycle slow sets spend 2.42*3*13 = 94.38s on std loop
  //  add in 9*2.42 for manafont and 9 GCDs for xeno+T3 and there is no time to generate an extra B3
  //- Fast sets can generate an extra B3 but run into swiftcast drift
  //- Assume that swiftcast lines up with B3 every minute or so effectively

  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP + coldB3P;
  let time = nCycles*120; 
  return potency/time; //pps = (potency*cycleTime) / (baseTime*120sec)
}

//Level 90 damage model
function newBLMThunderPps90(sps) {  
  let fastF3B3 = 0.7*290;
  let coldB3 = 290;
  let B4 = 300;
  let Xeno = 890;
  let F3P = 1.8*290;
  let F4 = 1.8*300;
  let Desp = 1.8*350;
  let Para = 540;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 + B4 + F3P + 2*Para + F4 * 6 + Desp;
  let MFCd = 100;

  let Gcd = GcdCalc(2.5, sps, false, 100);

  let baseTime = 4*(12*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 Para F3p 6F4 Para Desp = 12 GCDs
  // baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL;

  let cycleTime = (20/0.85 + 100); //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(9*Gcd); //Assume 6F4 + Para + Desp + F3p
  cycleTime += -5*Gcd; //4 Xeno + 1 Amp
  cycleTime += -4*Gcd; //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp); //manafont F3p is a gain at 90
  let thunderP = nCycles*4*(T3 + 9*SpsScalar(sps, 100)*T3Dot); // T3p is not affected by sps scalar
  let coldB3P = nCycles*(coldB3 - fastF3B3)*3; //gain from making 3 B3 casts instant per 2 min loop
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP + coldB3P;
  let time = nCycles*120; 
  return potency/time;
}


//Level 80 damage model
function newBLMThunderPps80(sps) {  
  let fastF3B3 = 0.7*290;
  let coldB3 = 290;
  let hotF3 = 1.4*290;
  let B4 = 300;
  let Xeno = 890;
  let F3P = 1.8*290;
  let F4 = 1.8*300;
  let Desp = 1.8*350;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 + B4 + fastF3B3 + F4 * 7 + Desp;
  let MFCd = 120;

  let Gcd = GcdCalc(2.5, sps, false, 100);

  let baseTime = 4*(11*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 F3 7F4 Desp = 11 GCDs

  let cycleTime = (20/0.85 + 100); //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(8*Gcd); //Assume 7F4 + Desp
  cycleTime += -4*Gcd; //4 Xeno no Amp
  cycleTime += -4*Gcd; //4 thunder refresh
  cycleTime += 2*Gcd;  //2 F4 lost from triplecast UI phase

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  let xenoP = nCycles*4*Xeno;
  let mfP = nCycles*(F4 * 7 + Desp); //manafont F3p is a gain at 80
  let thunderP = nCycles*4*(T3 + 9*SpsScalar(sps, 100)*T3Dot); // T3p is not affected by sps scalar
  let instantB3P = nCycles*(coldB3 - fastF3B3); //gain from making 1 B3 cast instant per 2 min cycle
  //do 1 triplecast ice phase per 2min cycle (cold B3, B4, hot F3)
  let tripleUIP = nCycles*(coldB3 + hotF3 - 2*fastF3B3 - 2*F4);
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP + instantB3P + tripleUIP;
  let time = nCycles*120; 
  return potency/time;
}

//Level 70 damage model
function newBLMThunderPps70(sps) {  
  let fastF3B3 = 0.7*290;
  let coldB3 = 290;
  let B4 = 300;
  let Foul = 600;
  let F3P = 1.8*290;
  let F4 = 1.8*300;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 + B4 + fastF3B3 + F4 * 7 ;
  let MFCd = 120;

  let Gcd = GcdCalc(2.5, sps, false, 100)

  let baseTime = 4*(10*Gcd); // why are we doing 4 loops? vestigial, it doesn't matter.
  // B3 B4 F3 7F4 = 10 GCDs

  let cycleTime = (20/0.85 + 100) //20 seconds spent under LL
  cycleTime += -(120/MFCd)*(7*Gcd) //Assume 7F4
  cycleTime += -4*Gcd //4 Xeno no Amp
  cycleTime += -4*Gcd //4 thunder refresh

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did

  let xenoP = nCycles*4*Foul;
  let mfP = nCycles*(F4 * 7); //assume that we're still using the manafont F3p for now
  let thunderP = nCycles*4*(T3 + 9*SpsScalar(sps, 100)*T3Dot); // T3p is not affected by sps scalar

  //Assume no cold B3 or hot F3 line at level 70 due to lack of instants
  //let coldB3P = (coldB3 - fastF3B3)*2; //gain from making 2 B3 casts instant per 4 full standard lines
  
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP;
  let time = nCycles*120; 
  return potency/time;
}
