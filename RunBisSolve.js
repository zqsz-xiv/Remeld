const f = require('./FindBisSets');
const fs = require("fs");

// Level to solve gear for
const lvl = 100;
// Sets below threshold percentage will not be included in final output
const thresh = 0.95;
// Forces the output to big melds, does not change the program logic. Set to false when using small and big melds.
const bigmeldflag = true;

const file_input = './testinput.csv';
const file_output = './testoutput.csv'

var output = f.findBisSets(file_input, lvl, thresh, bigmeldflag)

var out_csv = output
      .map((item) => {
      
        // Here item refers to a row in that 2D array
        var row = item;
        
        // Now join the elements of row with "," using join function
        return row.join(",");
      }) // At this point we have an array of strings
      .join("\n");

fs.writeFile(file_output, out_csv, { flag: 'w' }, err => {});