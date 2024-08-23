const fs = require("fs");
/* fs.readFile("7.05 TOP BiS input.csv", "utf-8", (err, data) => {
  if (err) console.log(err);
  else console.log(data);
}); */

var data = fs.readFileSync('7.05 TOP BiS input.csv')
    .toString() // convert Buffer to string
    .split('\n') // split string to lines
    .map(e => e.trim()) // remove white spaces for each line
    .map(e => e.split(',').map(e => e.trim())); // split each line to array

for (i in data) {
    console.log(data[i][2])
}

//console.log(data);
