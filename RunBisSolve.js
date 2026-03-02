const f = require('./FindBisSets');
const fs = require("fs");
const path = require("path");

// Ensure we always see errors from worker threads and don't exit silently.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
  process.exitCode = 1;
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Level to solve gear for
const lvl = 90;

// Sets below threshold percentage will not be included in final output
const thresh = 0.90;

// Forces the output to big melds, does not change the program logic. Set to false when using small and big melds.
const bigmeldflag = true;

//Deduplicates input gearsets based on groups of gear pieces (head/hands/feet) + (chest/legs) + (ears/neck/wrist/ring) that may provide identical substat totals
//This can be used to cull the amount of gearsets used in solving for synced ultimate BiS
//Default to false. Does not work with tome limits
const setStatDedup = false;

//Force meld size to be +72 for solving legacy ultimates with a relic weapon
const relicMeldOverride = false;

//Percentage point bonus to main stat from party bonus. 8 main raid content uses 5%, change to 4% if solving for Criterion dungeon BiS
const pBonus = 4;

//Cull gearsets based on the total amount of tomes and normal raid tokens. Tomes and tokens are two optional columns at the end of the gear input file
const useTomes = false;
const minTomes = 0;
const maxTomes = 1800;
const minTokens = 0;
const maxTokens = 16;


//Path to input file
const fileInput = './inputs_7.4/7.4 AloAlo BiS Input.csv';
var fileOutput = fileInput.replaceAll("input", "output");
fileOutput = fileOutput.replaceAll("Input", "Output");

// Leave this undefined to automatically set numWorkers based on the number of available cores
// on your computer. Set to 1 to make the solver run single-threaded.
const numWorkers = undefined;

const startTime = new Date();
console.error('Run start: ' + startTime.toLocaleString());

// Top-level async function wrapper is necessary to run worker threads.
(async () => {
  try {
    let output = await f.findBisSets(fileInput, lvl, thresh, bigmeldflag, setStatDedup, relicMeldOverride, pBonus, useTomes, minTomes, maxTomes, minTokens, maxTokens, numWorkers);
    let outCsv = output
      .map((item) => item.join(","))
      .join("\n");

    console.error('Writing output to: ' + fileOutput);
    const outDir = path.dirname(fileOutput);
    // Automatically make the output directory if it does not exist
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFile(fileOutput, outCsv, { flag: 'w' }, err => { if (err) console.error('Write failed:', err.message); });

    const endTime = new Date();
    console.error('Run end: ' + endTime.toLocaleString());
    const durationMs = (endTime - startTime)/1000;
    console.error('Duration: ' + durationMs);
  } catch (err) {
    console.error('Error:', err.message || err);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
})();
