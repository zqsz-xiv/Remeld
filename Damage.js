module.exports = {Damage, ExpectedActionDamage, CalcCritDamage, CalcCritRate, CalcDHRate, CalcDetDamage, getLvlMod, fl, SpsScalar}

// BLM Traits
const maimAndMend = 1.3;

/**
 * Damage Formula
 * Find damage of an attack with given potency and character stats.
 * Party bonus is a percentage bonus to main stat (5% for 8 man raid)
 */
function Damage(Potency, WD, JobMod, MainStat, Det, Crit, DH, lvl, eno, pbonus) {
  const { main, sub, M, div } = getLvlMod(lvl);
  
  //Apply party bonus. Per Dia, value of DET is sensitive to party bonus due to damage formula order of operations
  const MainStat_p = MainStat*(1 + (pbonus/100));

  let Damage = fl(Potency * (WD + fl(main * JobMod / 1000)) * (100 + fl((MainStat_p - main) * M / main)) / 100);
  Damage = fl(Damage * (1000 + fl(140 * (Det - main) / div)) / 1000);
  Damage = fl(Damage / 100);
  Damage = fl(Damage * maimAndMend); //BLM traits
  Damage = fl(Damage * eno); //BLM traits
  const CritDamage = fl(Damage * (1000 * CalcCritDamage(Crit, sub, div)) / 1000);
  const DHDamage = fl(Damage * 1250 / 1000);
  const CritDHDamage = fl(CritDamage * 1250 / 1000);
  const CritRate = CalcCritRate(Crit, sub, div);
  const DHRate = CalcDHRate(DH, sub, div);
  const CritDHRate = CritRate * DHRate;
  const NormalRate = 1 - CritRate - DHRate + CritDHRate;
  return Damage * NormalRate + CritDamage * (CritRate - CritDHRate) + DHDamage * (DHRate - CritDHRate) + CritDHDamage * CritDHRate;
}

/**
 * Damage Formula
 * Find base damage of an attack given potency, weapon damage, main stat, DET, and level
 * Party bonus is a percentage bonus to main stat (5% for 8 man raid)
 */
function BaseActionDamage(Potency, WD, JobMod, MainStat, Det, lvl, pbonus) {
  // Crit -> DH -> Trait -> Rand -> AF/UI Buff -> enochian
  // Except DoTs which are
  // Trait -> AF/UI Buff -> enochian -> Rand -> Crit -> DH

  const { main, sub, M, div } = getLvlMod(lvl);

  //Apply party bonus. Per Dia, value of DET is sensitive to party bonus due to damage formula order of operations
  const MainStat_p = fl(MainStat * (1 + (pbonus / 100)));

  //Common damage formula components
  const detMulti = (1000 + fl(140 * (Det - main) / div)) / 1000;
  const mainStatMulti = (100 + fl((MainStat_p - main) * M / main)) / 100;
  const wdMulti = WD + fl(main * JobMod / 1000);

  // Caster Damage has potency multiplied into weapon damage and then truncated
  // to an integer as opposed to into ap and truncated to 2 decimal.
  const apDet = fl(100 * mainStatMulti * detMulti) / 100;
  const baseDamage = fl(apDet * fl(wdMulti * Potency / 100));

  return baseDamage;
}


function CalcCritRate(Crit, base, div) { return fl(50 + (200 * (Crit - base) / div)) / 1000; }
function CalcCritDamage(Crit, base, div) { return (1000 + fl(200 * (Crit - base) / div + 400)) / 1000; }
function CalcDHRate(DH, base, div) { return fl(550 * (DH - base) / div) / 1000; }
function CalcDetDamage(Det, base, div) { return (1000 + fl(140 * (Det - base) / div)) / 1000; }

/**
 * Apply correction to expected damage value based on truncation of 5% damage variance
 */
function PostRandExpectedDamage(d) {
  let N = d;
  if (Math.round(d / 20) != d / 20) {
    N = N - 0.5;
  }
  return N;
}

/**
 * Crit/DH Damage Formula
 * Expected damage of an attack at for given crit / DH stats.
 */
function ExpectedActionDamage(Potency, AFUI, WD, JobMod, MainStat, Det, DH, Crit, SpS, lvl, eno, pbonus, isDOT = false) {

  //get level based stat mods
  const { main, sub, M, div } = getLvlMod(lvl);

  //base damage of the action
  const baseDamage = BaseActionDamage(Potency, WD, JobMod, MainStat, Det, lvl, pbonus);
  
  const CritRate = CalcCritRate(Crit, sub, div);
  const DHRate = CalcDHRate(DH, sub, div);
  //crit and DH rate are 3 dp., this step is to avoid floating point weirdness
  const CritDHRate = (fl(1000*CritRate) * fl(1000*DHRate)) / 1000000;
  const NormalRate = 1 - CritRate - DHRate + CritDHRate;

  const traitMulti = maimAndMend;

  let damageFinal;
  if (!isDOT) {
    // NOT a damage over time attack
    // Crit -> DH -> Trait -> Rand -> AF/UI Buff -> enochian
    
    const baseDamageDHit = fl(baseDamage * 1250 / 1000);  
    const baseDamageCrit = fl(baseDamage * (1000 * CalcCritDamage(Crit, sub, div)) / 1000);
    const baseDamageCDHit = fl(baseDamageCrit * 1250 / 1000);
    
    //Apply traits
    let expectedBaseDamage = fl(baseDamage * traitMulti);
    let expectedDHitDamage = fl(baseDamageDHit * traitMulti);
    let expectedCritDamage = fl(baseDamageCrit * traitMulti);
    let expectedCDHitDamage = fl(baseDamageCDHit * traitMulti);
    
    //note: if potency < 50, we would add +1 damage here, not relevant for BLM's non-DOT attacks

    //Astral Fire / Umbral Ice is a buff that comes after traits because f**k you that's why
    expectedBaseDamage = fl(expectedBaseDamage * AFUI);
    expectedDHitDamage = fl(expectedDHitDamage * AFUI);
    expectedCritDamage = fl(expectedCritDamage * AFUI);
    expectedCDHitDamage = fl(expectedCDHitDamage * AFUI);
    
    //Apply correction for truncation effect on random damage roll
    expectedBaseDamage = PostRandExpectedDamage(expectedBaseDamage);
    expectedDHitDamage = PostRandExpectedDamage(expectedDHitDamage);
    expectedCritDamage = PostRandExpectedDamage(expectedCritDamage);
    expectedCDHitDamage = PostRandExpectedDamage(expectedCDHitDamage);
        
    const N0 = expectedBaseDamage * NormalRate + expectedCritDamage * (CritRate - CritDHRate) + expectedDHitDamage * (DHRate - CritDHRate) + expectedCDHitDamage * CritDHRate;

    damageFinal = eno*N0 - (100 - gcd(100*eno - 100, 100))/200;

  } else {
    // damage over time attack
    // Trait -> AF/UI Buff -> enochian -> Rand -> Crit -> DH

    const spsMulti = (isDOT ? SpsScalar(SpS, lvl) : 1);
    const baseDamageDOT = fl(baseDamage * spsMulti) + ((Potency < 100) ? 1 : 0);

    // Factor in trait multiplier, as well as the 1 extra damage if potency is less than 100
    const preBuff = fl(baseDamageDOT * traitMulti)

    //Astral Fire / Umbral Ice is a buff that comes after traits
    const postBuff = fl(AFUI * preBuff);

    //Enochian is treated as a special buff, so apply here. Would apply after all party buffs
    let expectedBaseDamage = fl(postBuff * eno);

    //Apply correction for truncation effect on random damage roll
    expectedBaseDamage = PostRandExpectedDamage(expectedBaseDamage);

    const critMult = CalcCritDamage(Crit, sub, div);
    //Apply correction for truncation on random damage roll interaction with crit / DH buffs
    const expectedCritDamage = (critMult * expectedBaseDamage) - (1000 - gcd(1000*(critMult - 1), 1000))/2000;
    const expectedDHitDamage = 1.25*expectedBaseDamage - 0.375;
    const expectedCDHitDamage = 1.25*expectedCritDamage - 0.375;

    damageFinal = expectedBaseDamage * NormalRate + expectedCritDamage * (CritRate - CritDHRate) + expectedDHitDamage * (DHRate - CritDHRate) + expectedCDHitDamage * CritDHRate;

  }

  return damageFinal;

}

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

/**
 * Enhanced flooring function which takes into account a small margin of error to account for
 * floating point errors. Copied from xivgear.
 *
 * e.g. 2.3 * 100 => 229.99999999999997, which would normally floor to 229, but fl(2.3 * 100) => 230
 *
 * @param input
 */
function fl(input) {
    const floored = Math.floor(input);
    const loss = input - floored;
    // e.g. if input is 2.999..., then floored === 2 and loss === 0.999...
    // so we can just return floor + 1;
    if (loss >= 0.99999995) {
        return floored + 1;
    }
    else {
        return floored;
    }
}

/**
 * Determine Sps scalar for damage over time.
 *
 */
function SpsScalar(sps, lvl) {
  const { sub, div } = getLvlMod(lvl);
  let S = ((1000+fl(130*(sps-sub)/div))/1000);
  return S;
}

/**
 * Stein's algorithm for finding the GCD of two integers
 * JS implementation taken from: https://www.geeksforgeeks.org/dsa/steins-algorithm-for-finding-gcd/
 */
function gcd( a,  b)
{
    /* GCD(0, b) == b; GCD(a, 0) == a,
       GCD(0, 0) == 0 */
    if (a == 0)
        return b;
    if (b == 0)
        return a;

    /*Finding K, where K is the
      greatest power of 2
      that divides both a and b. */
    let k;
    for (k = 0; ((a | b) & 1) == 0; ++k) 
    {
        a >>= 1;
        b >>= 1;
    }

    /* Dividing a by 2 until a becomes odd */
    while ((a & 1) == 0)
        a >>= 1;

    /* From here on, 'a' is always odd. */
    do
    {
        /* If b is even, remove all factor of 2 in b */
        while ((b & 1) == 0)
            b >>= 1;

        /* Now a and b are both odd.
           Swap if necessary so a <= b,
           then set b = b - a (which is even).*/
        if (a > b){
        let t = a;
        a = b;
        b = t;
        }

        b = (b - a);
    }while (b != 0);

    /* restore common factors of 2 */
    return a << k;
}