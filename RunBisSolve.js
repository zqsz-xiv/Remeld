const f = require('./FindBisSets');
const fs = require("fs");

const lvl = 90;
const thresh = 0.96;
const bigmeldflag = true; // Forces the output to big melds, does not change the program logic. Set to false when using small and big melds.

//const smeldval = 18; //level 100 value
const smeldval = 12; //level 90 value

const meldmult = 3; // What multiple of small melds is a big meld, this must be an integer on v4, for fundamental implementation (performance) reasons.
const file_input = './7.05 DSR BiS input full version.csv';
const file_output = './7.05 DSR BiS full version output.csv'


var output = f.findBisSets(file_input, lvl, thresh, bigmeldflag, smeldval, meldmult)

var out_csv = output
      .map((item) => {
      
        // Here item refers to a row in that 2D array
        var row = item;
        
        // Now join the elements of row with "," using join function
        return row.join(",");
      }) // At this point we have an array of strings
      .join("\n");

fs.writeFile(file_output, out_csv, { flag: 'a' }, err => {});