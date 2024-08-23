module.exports = {BLMThunderPps}

function BLMThunderPps (sps, lvl) {
  switch(lvl) {
    case 70:
      return newBLMThunderPps70(sps);
    case 80:
      return newBLMThunderPps80(sps);
    case 90:
      return newBLMThunderPps90(sps);
    default:
      return newBLMThunderPps(sps); 
  }
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

function newBLMThunderPps(sps) {  
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

  let shortGcd = GcdCalc100(2500, sps, false)
  let longGcd = GcdCalc100(2800, sps, false)
  let despGcd = GcdCalc100(3000, sps, false)
  let instantGain9 = (4*(despGcd+casterTax-shortGcd) + 5*(longGcd+casterTax-shortGcd)); // assume triple on F4/Desp/FS x2 + 3x swift on F4
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc100(2500,sps, false),150) + Math.floor(100*0.5*GcdCalc100(3500, sps, false))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc100(2500,sps, true),150) + Math.floor(100*0.5*GcdCalc100(3500, sps, true))),0)/100
  // short gcds = 4 * (5; B4, 2* Para, 2* fastcast)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (9; b4, 6F4, despair, FS)

  let baseTime = 20 * shortGcd + 24 * longGcd + 8 * despGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 36 * casterTax;

  let cycleTime = (30/0.85 + 90) + instantGain9
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 2 * despGcd + 8 * casterTax) //Manafont fire phase
  cycleTime += -5*shortGcd //4 Xeno + 1 Amp

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp + FS);
  let thunderP = nCycles*4*(HT + 10*SpsScalar100(sps)*HTDot); // T3p is not affected by sps scalar
  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP;
  let time = nCycles*120; 
  return potency/time;
}

function SpsScalar100(SpS) {
  //updated for new DT stat modifier
  let S = ((1000+Math.floor(130*(SpS-420)/2780))/1000);
  return S;
}

function GcdCalc100(gcd, sps, llFlag) {
  let time = Math.floor(Math.floor(1000 * (llFlag ? 85 : 100)  * (Math.floor(gcd * (1000 - Math.floor(130 * (sps-420) / 2780))/1000) / 1000)) / 1000)/100;
  return time;
}


//Level 90 damage model
function newBLMThunderPps90(sps) {  
  let casterTax = 0.12; // 0.1 + 2/fps
  let fastF3B3 = 0.7*280;
  let B4 = 320;
  let Xeno = 880;
  let F3P = 1.8*280;
  let F4 = 1.8*320;
  let Desp = 1.8*350;
  let Para = 520;
  let T3 = 120;
  let T3Dot = 50;
  let F4Rotation = fastF3B3 + B4 + F3P + 2*Para + F4 * 6 + Desp + FS;
  let MFCd = 100;

  let shortGcd = GcdCalc90(2500, sps, false)
  let longGcd = GcdCalc90(2800, sps, false)
  let despGcd = GcdCalc90(3000, sps, false)
  let instantGain8 = (3*(despGcd+casterTax-shortGcd) + 5*(longGcd+casterTax-shortGcd)); // say, 3 despairs 5 f4s being instant
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc90(2500,sps, false),150) + Math.floor(100*0.5*GcdCalc90(3500, sps, false))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc90(2500,sps, true),150) + Math.floor(100*0.5*GcdCalc90(3500, sps, true))),0)/100
  // short gcds = 4 * (5; B4, 2* Para, 2* fastcast)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (8; b4, 6F4, despair)
  let baseTime = 20 * shortGcd + 24 * longGcd + 4 * despGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 32 * casterTax;
  
  let cycleTime = (30/0.85 + 90) + instantGain8
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 1 * despGcd + 7 * casterTax) //Manafont fire phase
  cycleTime += -5*shortGcd //4 Xeno + 1 Amp

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + Para + F4 * 6 + Desp);
  let thunderP = nCycles*4*(T3 + 10*SpsScalar90(sps)*T3Dot); // T3p is not affected by sps scalar

  let potency = 4 * (F4Rotation) + xenoP + mfP + thunderP;
  let time = nCycles*120; 
  return potency/time;
}

function SpsScalar90(SpS) {
  //EW values
  let S = ((1000+Math.floor(130*(SpS-400)/1900))/1000);
  return S;
}
function GcdCalc90(gcd, sps, llFlag) {
  let time = Math.floor(Math.floor(1000 * (llFlag ? 85 : 100)  * (Math.floor(gcd * (1000 - Math.floor(130 * (sps-400) / 1900))/1000) / 1000)) / 1000)/100;
  return time;
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
  let MFCd = 100;

  let fProcNum = 0.4;

  let shortGcd = GcdCalc90(2500, sps, false)
  let longGcd = GcdCalc90(2800, sps, false)
  let despGcd = GcdCalc90(3000, sps, false)
  let instantGain8 = (3*(despGcd+casterTax-shortGcd) + 5*(longGcd+casterTax-shortGcd)); // say, 3 despairs 5 f4s being instant
  
  let fastB3F3Clips = Math.max((70 - Math.max(100*GcdCalc90(2500,sps, false),150) + Math.floor(100*0.5*GcdCalc90(3500, sps, false))),0)/100
  let fastB3F3ClipsLL = Math.max((70 - Math.max(100*GcdCalc90(2500,sps, true),150) + Math.floor(100*0.5*GcdCalc90(3500, sps, true))),0)/100
  // short gcds = 4 * (4; B4, 1* F1, 2* fastcast)
  // long gcds = 4 * 6 F4s
  // caster tax = 4 * (9; B4, F1, 6F4, despair)
  let baseTime = 16 * shortGcd + 24 * longGcd + 4 * despGcd; // why are we doing 4 loops? vestigial, it doesn't matter.
  baseTime += 1*fastB3F3Clips + 1*fastB3F3ClipsLL  + 36 * casterTax;
  
  let cycleTime = (30/0.85 + 90) + instantGain8
  cycleTime += -(120/MFCd)*(2 * shortGcd + 6 * longGcd + 1 * despGcd + 7 * casterTax) //Manafont fire phase
  cycleTime += -5*shortGcd //4 Xeno + 1 Amp
  cycleTime += fProcNum*shortGcd // AF3 F3p cast

  let nCycles = baseTime/cycleTime; // how many 120s cycles we actually did
  let xenoP = nCycles*5*Xeno;
  let mfP = nCycles*(F3P + F1 + F4 * 6 + Desp);
  let thunderP = nCycles*4*(T3 + 10*SpsScalar90(sps)*T3Dot); // T3p is not affected by sps scalar

  //F3 proc adds an extra fastF3B3 worth of potency with AF1 F3p
  //For now assume AF3 F3p
  let potency = 4 * (F4Rotation +  fProcNum * F3P) + xenoP + mfP + thunderP; 
  let time = nCycles*120; 
  return potency/time;
}

function SpsScalar80(SpS) {
  //EW values
  let S = ((1000+Math.floor(130*(SpS-400)/1900))/1000);
  return S;
}
function GcdCalc80(gcd, sps, llFlag) {
  let time = Math.floor(Math.floor(1000 * (llFlag ? 85 : 100)  * (Math.floor(gcd * (1000 - Math.floor(130 * (sps-400) / 1900))/1000) / 1000)) / 1000)/100;
  return time;
}

function newBLMThunderPps70(sps) { 
  return 0;
}
