const fp = require('./NewBLMPps');
const fm = require('./FindMeldSets');
const fd = require('./Damage')

var [det,dh,crit,ss] = [2210,1382,2686,2310];
// var [det,dh,crit,ss] = [2228,1436,2686,2238];

const BLM_JOBMOD = 115;
//note: sub = 420, div = 2780 at level 100

var wd = 148;
var int = 5168;
var pps = fp.BLMThunderPps(ss, 100);
var dmg = fd.Damage(pps, wd, BLM_JOBMOD, int, det, crit, dh, 100, 1.27);
var dmg_100 = fd.Damage(100, wd, BLM_JOBMOD, int, det, crit, dh, 100, 1.27);
var gcd = fp.GcdCalc(2.5, ss, false, 100);
var SpsScalar = fp.SpsScalar(ss, 100);

console.log('GCD: ' + gcd);
console.log('SpS Dot scalar: ' + SpsScalar);
console.log('100 pot dmg: ' + dmg_100);
console.log('Expected pps: ' + pps);
console.log('full sim dmg: ' + dmg);