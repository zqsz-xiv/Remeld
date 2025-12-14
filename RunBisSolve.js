const f = require('./FindBisSets');
const fs = require("fs");

// Level to solve gear for
const lvl = 100;

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

//Cull gearsets based on the total amount of tomes. Tomes are an optional rightmost column  of the gear input file
const useTomes = true;
const minTomes = 750;
const maxTomes = 900;

//Path to input file
const file_input = './inputs_7.4/7.2 full BiS Input tome test.csv';
var file_output = file_input.replaceAll("input", "output");
file_output = file_output.replaceAll("Input", "Output");


var output = f.findBisSets(file_input, lvl, thresh, bigmeldflag, setStatDedup, relicMeldOverride, useTomes, minTomes, maxTomes)

var out_csv = output
      .map((item) => {
      
        // Here item refers to a row in that 2D array
        var row = item;
        
        // Now join the elements of row with "," using join function
        return row.join(",");
      }) // At this point we have an array of strings
      .join("\n");

console.log('Writing output to: ' + file_output);
fs.writeFile(file_output, out_csv, { flag: 'w' }, err => {});