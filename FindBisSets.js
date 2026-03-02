//level 100 melds
//const MELDVAL = 54;
//const smeldVal = 18;

//level 90 melds
//const MELDVAL = 36;
//const smeldVal = 12;

const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const os = require("os");
const fp = require('./NewBLMPps');
const fm = require('./FindMeldSets');
const fd = require('./Damage')

const BLM_JOBMOD = 115;

const LOGNUM = 100; // log every LOGNUM sets, or every 1% of progress, whichever is less logging

/** 
* Generates all possible gearSets from the data in the spreadsheet.
* Then, for each gearSet, finds the optimal meldSets it produces. Combines the outputs, and produces the overall optimal meldSet for each sps value.
* Finally, outputs all the sets within BISTHRESH of the best, using an update of Furst's model.
* Allowing full overmelds impacts performance severely.
*/
async function findBisSets(
  filename,
  lvl,
  bisThresh,
  bigMeldFlag,
  setStatDedup,
  relicMeldOverride,
  pbonus = 5,
  useTomes = false,
  minTomes = 0,
  maxTomes = 10 ** 6,
  minTokens = 0,
  maxTokens = 64,
  numWorkers
){
  var baseint = 0;
  var eno = 1.0;
  var basestats = [0, 0, 0, 0];
  //var meldVal = smeldVal*meldMult;

  //Determine base stats from level
  //base stats are Det, DH, Crit, SS
  //baseint assumes Midlander
  switch (lvl) {
    case 70:
      baseint = 338;
      var basestats = [292, 364, 364, 364];
      eno = 1.10;
      //Materia at this level is actually +6/+16, which means bigmeld is NOT an integer multiple of smallmeld
      //Hence DO NOT solve for small melds at level 70
      
      smeldVal = 8; 
      if (!relicMeldOverride){
        meldMult = 2; 
      } else {
        meldMult = 9;
      }
      break;
    case 80:
      baseint = 394;
      var basestats = [340, 380, 380, 380];
      eno = 1.15;
      smeldVal = 8;
      if (!relicMeldOverride){
        meldMult = 3; 
      } else {
        meldMult = 9;
      }
      break;
    case 90:
      baseint = 451;
      var basestats = [390, 400, 400, 400];
      eno = 1.22;
      smeldVal = 12;
      meldMult = 3;
      break;
    default:
    case 100:
      baseint = 505;
      var basestats = [440, 420, 420, 420];
      eno = 1.27;
      smeldVal = 18;
      meldMult = 3;
      break;
  }

  if (setStatDedup) {
    var [gearSets, foodList] = loadGearSets_StatDedup(filename, baseint, basestats, false, smeldVal, meldMult, useTomes, minTomes, maxTomes, minTokens, maxTokens); 
  } else {
    var [gearSets, foodList] = loadGearSets(filename, baseint, basestats, false, smeldVal, meldMult, useTomes, minTomes, maxTomes, minTokens, maxTokens); 
  }

  console.log('Loaded ' + gearSets.length + ' gearsets.');
  console.log(foodList);
  //for(let i = 0; i < 10; i++) console.log(gearSets[i]);
  var bisSets = new Map(); // Best sets for each SS value achievable
  var bisBests = new Map();
  var bisMelds = new Map();
  var bisFoods = new Map();

  fp.setLevelToSolve(lvl);

  const numThreads = numWorkers === undefined ? Math.max(1, os.cpus().length - 1) : (numWorkers <= 1 ? 0 : numWorkers);
  if (numThreads > 0) {
    // Workers run in separate V8 isolates and don't share memory with the main thread, so we need
    // to serialize them to simple objects. Replacing the `GearSet` class with a binary format that
    // is compatible with SharedArrayBuffers would remove this memory overhead.
    const serializedGearSets = gearSets.map((g) => g.serialized());
    const logStep = Math.max(LOGNUM, Math.floor(gearSets.length / 100));
    const chunkSize = Math.ceil(serializedGearSets.length / numThreads);
    const workerPath = path.join(__dirname, 'FindBisSetsWorker.js');
    const params = { lvl, eno, smeldVal, pbonus, logInterval: Math.max(1, Math.floor(chunkSize / 50)) };
    const workerPromises = [];
    const workerProgress = [];
    let nextLogAt = logStep;
    for (let start = 0; start < serializedGearSets.length; start += chunkSize) {
      // Distribute an even portion of the search space to each worker thread.
      const end = Math.min(start + chunkSize, serializedGearSets.length);
      if (start >= end) break;
      const chunk = serializedGearSets.slice(start, end);
      workerProgress.push(0);
      const workerId = workerPromises.length;
      workerPromises.push(
        new Promise((resolve, reject) => {
          const worker = new Worker(workerPath, {
            workerData: { gearSetsChunk: chunk, foodList, params, workerId }
          });
          worker.on('message', (msg) => {
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'progress' || msg.type === 'done') {
              workerProgress[workerId] = msg.processed;
              const total = workerProgress.reduce((a, b) => a + b, 0);
              while (total >= nextLogAt) {
                console.log(`Processed ${nextLogAt} sets...`);
                nextLogAt += logStep;
              }
              if (msg.type === 'done') {
                if (total > 0 && total !== nextLogAt - logStep) {
                  console.log(`Processed ${total} sets...`);
                }
                resolve(msg.results);
              }
            }
          });
          worker.on('error', (err) => {
            console.error('Worker error:', err.message || err);
            reject(err);
          });
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error('Worker stopped with exit code ' + code));
            }
          });
        })
      );
    }
    console.log(`Using ${workerPromises.length} worker(s).`);
    try {
      const results = await Promise.all(workerPromises);
      for (const part of results) {
        for (const { sps, mult, gearSet, meld, food } of part) {
          if (!bisBests.has(sps) || bisBests.get(sps) < mult) {
            bisBests.set(sps, mult);
            bisSets.set(sps, gearSet);
            bisMelds.set(sps, meld);
            bisFoods.set(sps, food);
          }
        }
      }
    } catch (err) {
      console.error(`Worker failed: ${err.message || err}`);
      throw err;
    }
  } else {
    // Single-threaded approach
    let logCount = 0;
    gearSets.forEach(gearSet => {
      const melds = fm.findMeldSets(gearSet);
      for (let meld of melds){
        for (let food of foodList){
          const sps = totalStats(gearSet, meld, food, 'SS', smeldVal);
          const mult = setDamage(gearSet, meld, food, lvl, eno, smeldVal, pbonus);
          if (!bisSets.has(sps) || bisBests.get(sps) < mult) {
            bisBests.set(sps, mult);
            bisSets.set(sps, gearSet);
            bisMelds.set(sps, meld);
            bisFoods.set(sps, food);
          }
        }
      }
      logCount++;
      if (logCount % Math.max(LOGNUM,Math.floor(gearSets.length / 100)) == 0) {
        console.log(`Processed ${logCount} sets...`);
      }
    });
  }
  var spsVals = Array.from(bisSets.keys());
  spsVals.sort(function(a,b) {return a-b});
  var bestDmg = 0;
  for (let sps of spsVals){
    var currDmg = setDamage(bisSets.get(sps), bisMelds.get(sps), bisFoods.get(sps), lvl, eno, smeldVal, pbonus);
    if (currDmg > bestDmg) bestDmg = currDmg;
  }
  var setList = [];
  for (let sps of spsVals){
    var currDmg = setDamage(bisSets.get(sps), bisMelds.get(sps), bisFoods.get(sps), lvl, eno, smeldVal, pbonus);
    if (currDmg > bestDmg*bisThresh){
      setList.push([bisSets.get(sps), bisMelds.get(sps), bisFoods.get(sps), currDmg, sps]);
    }
  }
  
  //for(let i in setList){
  //  console.log("Sps " + setList[i][4] + ": \n" + setList[i][0].pieces + " \nMelds (maybe small): " + meldToString(setList[i][1], bigMeldFlag, meldMult) + "\nDamage: " + setList[i][3] + '(% of best: '+ setList[i][3]/bestDmg + ")\n[Det,DH,Crit,SS]: " + getStats(setList[i][0], setList[i][1], setList[i][2], smeldVal), setList[i][2] + '\nInt: ' + setList[i][0].int);
  //}

  // Sheet output: (Sps, [Det,DH,Crit,SS], Int, Small Melds, Pieces)
  var output = [['Sps', 'Damage', '% of best', 'GCD', 'Det', 'DH', 'Crit', 'Int', 'Small Melds', ',,','Food', 'Pieces']];
  if (bigMeldFlag) output = [['Sps', 'Damage', '% of best', 'GCD', 'Det', 'DH', 'Crit', 'Int', 'Melds', ',,','Food', 'Pieces']];

  for(let i in setList){
    var stats = getStats(setList[i][0], setList[i][1], setList[i][2], smeldVal);
    output.push([setList[i][4], setList[i][3], 100.0*setList[i][3]/bestDmg, fp.GcdCalc(2.5, setList[i][4], false, lvl)
      ,stats[0], stats[1], stats[2], Math.floor(setList[i][0].int * (1+(pbonus/100))), meldToString(setList[i][1], bigMeldFlag, meldMult), setList[i][2].name, setList[i][0].pieces.toString()]);
  }
  return output;
}

function getStats(gearset, meld, food, smeldVal){
  var det = totalStats(gearset, meld, food, 'Det', smeldVal);
  var dh = totalStats(gearset, meld, food, 'DH', smeldVal);
  var crit = totalStats(gearset, meld, food, 'Crit', smeldVal);
  var ss = totalStats(gearset, meld, food, 'SS', smeldVal);
  return [det, dh, crit, ss];
}

function totalStats(gearset, meld, food, statName, smeldVal){
  var stat = gearset.stats[getStatNum(statName)] + fm.getMelds(meld, statName)*smeldVal;
  if (food.primary == statName) stat += Math.min(food.primVal, Math.floor(0.10*stat));
  if (food.secondary == statName) stat += Math.min(food.secVal, Math.floor(0.10*stat));
  return stat;
}

/**
 * Finds the damage of a given set and melds at a supplied level.
 */
function setDamage(gearset, meld, food, lvl, eno, smeldVal, pbonus){
  //console.log('setDamage food:', food)
  var det = totalStats(gearset, meld, food, 'Det', smeldVal);
  var dh = totalStats(gearset, meld, food, 'DH', smeldVal);
  var crit = totalStats(gearset, meld, food, 'Crit', smeldVal);
  var ss = totalStats(gearset, meld, food, 'SS', smeldVal);


  var ppst = fp.BLMThunderPps(ss); // Using own model
  var wd = gearset.wd;
  var int = gearset.int;
  var jobMod = BLM_JOBMOD; // TODO figure this one out?
  //console.log(ppst);
  //console.log('Calling Damage with [' + ppst + ', ' + wd + ', ' + jobMod + ', ' + int + ', ' + det + ', ' + crit + ', ' + dh + ', ' + 90 + '].');
  return fd.Damage(ppst, wd, jobMod, int, det, crit, dh, lvl, eno, pbonus);
}

function meldToString(meld, bigMeldFlag, meldMult){
  if (bigMeldFlag) return bigMeldToString(meld, meldMult);
  else return 'Det: ' + fm.getMelds(meld,'Det',false).toString() + ', DH: ' + fm.getMelds(meld,'DH',false).toString()  
    + ', Crit:' + fm.getMelds(meld,'Crit',false).toString()  + ", SS:" + fm.getMelds(meld, 'SS', false).toString();
}

function bigMeldToString(meld, meldMult){
  return 'Det: ' + (fm.getMelds(meld,'Det',false)/meldMult).toString() + ', DH: ' + (fm.getMelds(meld,'DH',false)/meldMult).toString()  
    + ', Crit:' + (fm.getMelds(meld,'Crit',false)/meldMult).toString()  + ", SS:" + (fm.getMelds(meld, 'SS', false)/meldMult).toString();
}

const cartesian =
  (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

/**
 * Expected input:
 * Name, Slot, Int, Weapon Damage, Meld Slots, Small Meld Slots, 
 * allowFullOvermelds = true, allows FULL OVERMELDS i.e. put all the materia to the secondary stat even if it overflows
 */
function loadGearSets(filename, baseint, basestats, allowFullOvermelds, smeldVal, meldMult, useTomes, minTomes, maxTomes, minTokens, maxTokens){

  var data = fs.readFileSync(filename)
    .toString() // convert Buffer to string
    .split('\n') // split string to lines
    .map(e => e.trim()) // remove white spaces for each line
    .map(e => e.split(',').map(e => e.trim())); // split each line to array


  var pieces = new Map();
  for (i in data) {
    if (data[i][0] != 'Name'){
      const piece = new Piece(data[i][0], data[i][1], parseInt(data[i][2]), parseInt(data[i][3]), parseInt(data[i][4]),
      parseInt(data[i][5]), data[i][6], parseInt(data[i][7]), data[i][8], parseInt(data[i][9]), smeldVal, meldMult);
      if (useTomes) {
        piece.tomes = parseInt(data[i][10]);
        piece.tokens = parseInt(data[i][11]);
      }
      if (!pieces.has(piece.slot)) pieces.set(piece.slot, []);
      pieces.get(piece.slot).push(piece);
      if (allowFullOvermelds && piece.canOvermeld()){
        pieces.get(piece.slot).push(piece.overmeld());
      }
    }
  }
  const slots = ['Weapon', 'Chest', 'Legs', 'Hands', 'Feet', 'Head', 'Ear', 'Neck', 'Wrist'];

  // Choice of 2 rings, assumed no repetitions
  var preSets = [];
  var rings = pieces.get('Finger');
  for(let i = 0; i < rings.length; i++){
    for(let j = i+1; j < rings.length; j++){
      if (!rings[j].name.includes(rings[i].name)){
        var currSet = [];
        currSet.push(rings[i]);
        currSet.push(rings[j]);
        preSets.push(currSet);
      }
    }
  }

  var numSets = preSets.length;
  slots.forEach(slot => {
    numSets *= pieces.get(slot).length;
  });
  console.log('All pieces loaded. Total combinations expected: ' + numSets);

  //console.log(preSets);
  slots.forEach(slot => {
    preSets = cartesian(preSets, pieces.get(slot));
  });

  //remove sets that don't satisfy tome constraints
  if (useTomes){
    var auxSets = [];
    preSets.forEach(preSet => {
      var setTomes = 0;
      var setTokens = 0;
      preSet.forEach(piece => setTomes = setTomes + piece.tomes);
      preSet.forEach(piece => setTokens = setTokens + piece.tokens);
      if (setTomes >= minTomes && setTomes <= maxTomes && setTokens >= minTokens && setTokens <= maxTokens) auxSets.push(preSet);
    });
    preSets = auxSets;
    console.log('Sets satisfying tomes constraints: ' + preSets.length);
  }

  var gearSets = preSets.map(preSet => {
    gearSet = new GearSet(baseint, basestats);
    preSet.forEach(piece => gearSet.addPiece(piece));
    return gearSet;
  });

  return [gearSets, pieces.get('Food')];
}

function loadGearSets_StatDedup(filename, baseint, basestats, allowFullOvermelds, smeldVal, meldMult, useTomes, minTomes, maxTomes){

  var data = fs.readFileSync(filename)
    .toString() // convert Buffer to string
    .split('\n') // split string to lines
    .map(e => e.trim()) // remove white spaces for each line
    .map(e => e.split(',').map(e => e.trim())); // split each line to array


  var pieces = new Map();
  for (i in data) {
    if (data[i][0] != 'Name'){
      const piece = new Piece(data[i][0], data[i][1], parseInt(data[i][2]), parseInt(data[i][3]), parseInt(data[i][4]),
      parseInt(data[i][5]), data[i][6], parseInt(data[i][7]), data[i][8], parseInt(data[i][9]), smeldVal, meldMult);
      if (useTomes) piece.tomes = parseInt(data[i][10]);
      if (!pieces.has(piece.slot)) pieces.set(piece.slot, []);
      pieces.get(piece.slot).push(piece);
      if (allowFullOvermelds && piece.canOvermeld()){
        pieces.get(piece.slot).push(piece.overmeld());
      }
    }
  }
  
  //First stat group: chest / legs
  var partSetsMajor = [];
  var chests = pieces.get('Chest');
  var legs = pieces.get('Legs');
  var statCombos = [];
  for (let i = 0; i < chests.length; i++) {
    for (let j = 0; j < legs.length; j++) {
      gs = new GearSet(baseint, basestats);
      gs.addPiece(chests[i]);
      gs.addPiece(legs[j]);
      if (!arraysDuplicateCheck(statCombos, gs.stats)) {
        statCombos.push(gs.stats);
        partSetsMajor.push(gs);
      }
    }
  }
  console.log('Loaded Chest/Legs Combinations: ' + partSetsMajor.length);

  //second stat group: head / hands / feet
  var partSetsMinor = [];
  var heads = pieces.get('Head');
  var hands = pieces.get('Hands');
  var feet = pieces.get('Feet');
  var statCombos = [];
  for (let i = 0; i < heads.length; i++) {
    for (let j = 0; j < hands.length; j++) {
      for (let k = 0; k < feet.length; k++) {
        gs = new GearSet(baseint, basestats);
        gs.addPiece(heads[i]);
        gs.addPiece(hands[j]);
        gs.addPiece(feet[k]);
        if (!arraysDuplicateCheck(statCombos, gs.stats)) {
          statCombos.push(gs.stats);
          partSetsMinor.push(gs);
        }
      }
    }
  }
  console.log('Loaded Head/Hands/Feet Combinations: ' + partSetsMinor.length);

  //third stat group: accessories
  var partSetsAccessories = [];
  var ears = pieces.get('Ear');
  var necks = pieces.get('Neck');
  var wrists = pieces.get('Wrist');
  var fingers = pieces.get('Finger');
  var statCombos = [];
  for (let i = 0; i < ears.length; i++) {
    for (let j = 0; j < necks.length; j++) {
      for (let k = 0; k < wrists.length; k++) {
        for (let m = 0; m < fingers.length; m++) {
          for (let n = m + 1; n < fingers.length; n++) {
            if (!fingers[m].name.includes(fingers[n].name)) {
              gs = new GearSet(baseint, basestats);
              gs.addPiece(ears[i]);
              gs.addPiece(necks[j]);
              gs.addPiece(wrists[k]);
              gs.addPiece(fingers[m]);
              gs.addPiece(fingers[n]);
              if (!arraysDuplicateCheck(statCombos, gs.stats)) {
                statCombos.push(gs.stats);
                partSetsAccessories.push(gs);
              }
            }
          }
        }
      }
    }
  }
  console.log('Loaded Accessory Combinations: ' + partSetsAccessories.length);
  console.log('All pieces loaded. Total combinations expected: ' + partSetsMajor.length*partSetsMinor.length*partSetsAccessories.length*pieces.get('Weapon').length);



  // var gearSets = preSets.map(preSet => {
  //   gearSet = new GearSet(baseint, basestats);
  //   preSet.forEach(piece => gearSet.addPiece(piece));
  //   return gearSet;
  // });
  var gearSets = [];
  for (let i = 0; i < partSetsMajor.length; i++) {
    for (let j = 0; j < partSetsMinor.length; j++) {
      for (let k = 0; k < partSetsAccessories.length; k++) {
        for (let m = 0; m < pieces.get('Weapon').length; m++) {
        gs = new GearSet(baseint, basestats);
        gs.addGearSet(partSetsMajor[i], baseint, basestats);
        gs.addGearSet(partSetsMinor[j], baseint, basestats);
        gs.addGearSet(partSetsAccessories[k], baseint, basestats);
        gs.addPiece(pieces.get('Weapon')[m]);
        
        //Hacked in logic to handle MDville weapon bonus stats
        var n = pieces.get('Weapon')[m].name.length;
        if (pieces.get('Weapon')[m].name.substring(n-1) == "#") {
          gs.stats[parseInt(pieces.get('Weapon')[m].name.substring(n-2))] += 72;
        }
        
        gearSets.push(gs);
        }
      }
    }
  }

  return [gearSets, pieces.get('Food')];
}


/**
 * A piece has a primary and secondary stat type names, a slot that it fills, and a number of melds. Each piece knows its possible meld configurations.
 * A meld configuration is a list [det, dh, crit, ss, sdet, sdh, scrit, sss] of how many melds of each type are used.
 */
class Piece{
  constructor(name, slot, int, wd, melds, smallMelds, primary, primVal, secondary, secVal, smeldVal, meldMult){
    this.name = name;
    this.slot = slot;
    this.int = int;
    this.wd = wd;
    this.melds = melds;
    this.smallMelds = smallMelds;
    this.primary = primary;
    this.primVal = primVal;
    this.secondary = secondary;
    this.secVal = secVal;
    
    this.meldConfigs = []; // adds all meld configurations with no overmelds. this is so gross it's amazing.
    for(let ndet = 0; ndet <= melds; ndet++) 
      for (let ndh = 0; ndh <= melds-ndet; ndh++)
        for (let ncrit = 0; ncrit <= melds-ndet-ndh; ncrit++){
          let nss = melds-ndet-ndh-ncrit;
            for(let nsdet = 0; nsdet <= smallMelds; nsdet++) 
              for (let nsdh = 0; nsdh <= smallMelds-nsdet; nsdh++)
                for (let nscrit = 0; nscrit <= smallMelds-nsdet-nsdh; nscrit++){
                  let nsss = smallMelds-nsdet-nsdh-nscrit;
                  const meldConfig = [ndet*meldMult+nsdet, ndh*meldMult+nsdh, ncrit*meldMult+nscrit, nss*meldMult+nsss];
                  const pnum = getStatNum(primary);
                  const snum = getStatNum(secondary);
                  if ((meldConfig[pnum] == 0) && ((primVal - secVal) >= (meldConfig[snum]*smeldVal))){
                    this.meldConfigs.push(meldConfig);
                  }
                }
        }
  }
  canOvermeld(){
    return  (this.primVal - this.secVal < this.melds*smeldVal*meldMult + this.smallMelds*smeldVal);
  }
  overmeld(){
    return new Piece(this.name + ' (' + this.secondary + ' overmeld)', this.slot, this.int, this.wd, 0, 0, this.primary, this.primVal, this.secondary, this.secVal, smeldVal, meldMult);
  }
}

/**
 * A gear set has an amount of stats and pieces.
 * Note that stats start at base.
 */
class GearSet {
  constructor(baseint, basestats) {
    this.int = baseint;
    this.wd = 0;
    this.stats = basestats.slice();
    this.pieces = [];
    this.pieceMeldConfigs = [];
  }
  addPiece(piece) {
    this.pieces.push(piece.name);
    this.pieceMeldConfigs.push(piece.meldConfigs);
    this.int += piece.int;
    this.wd += piece.wd;
    this.stats[getStatNum(piece.primary)] += piece.primVal;
    this.stats[getStatNum(piece.secondary)] += piece.secVal;
  }
  addGearSet(gs, baseint, basestats) {
    for (var j = 0; j < gs.pieces.length; j++) {
      this.pieces.push(gs.pieces[j])
      this.pieceMeldConfigs.push(gs.pieceMeldConfigs[j])
    }
    this.int += gs.int - baseint;
    this.wd += gs.wd;
    for (var i = 0; i < 4; i++) {
      this.stats[i] += gs.stats[i] - basestats[i];
    }
  }
  // Serialization and deserialization methods necessary for sending GearSet objects
  // to/from a worker thread.
  // These methods do NOT deep copy the contents of child arrays: the node runtime performs
  // deep clones when sending objects to worker threads, and we assume that no more mutations are
  // performed at this point, so it's safe to avoid cloning the child arrays.
  serialized() {
    return {
      int: this.int,
      wd: this.wd,
      stats: this.stats,
      pieces: this.pieces,
      pieceMeldConfigs: this.pieceMeldConfigs,
    };
  }
  static deserialize(obj) {
    const gearSet = new GearSet(obj.int, obj.stats);
    gearSet.wd = obj.wd;
    gearSet.pieces = obj.pieces;
    gearSet.pieceMeldConfigs = obj.pieceMeldConfigs;
    return gearSet;
  }
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

function arraysIdentical(a, b) {
  var i = a.length;
  if (i != b.length) return false;
  while (i--) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

function arraysDuplicateCheck(list, a) {
  var i = list.length;
  while (i--) {
    if (arraysIdentical(list[i], a)) return true;
  }
  return false;
}

module.exports = { findBisSets, totalStats, setDamage, GearSet }
