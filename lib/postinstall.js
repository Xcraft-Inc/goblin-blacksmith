'use strict';

const fs = require('fs');
const path = require('path');

let yogaPath = require.resolve('@react-pdf/yoga');

if (!yogaPath) {
  process.exit(0);
}

yogaPath = path.resolve(path.dirname(yogaPath), '..');
const nbindPath = path.join(yogaPath, 'build/Release/nbind.js');

const nbindBuffer = fs.readFileSync(nbindPath);
const it = nbindBuffer.indexOf(
  Buffer.from('Module["TOTAL_MEMORY"] || 268435456')
);
if (it === -1) {
  process.exit(0);
}

/* Patch 256 MB to 1 GB */
nbindBuffer.write('Module["TOTAL_MEMORY"] ||1073741824', it);
fs.writeFileSync(nbindPath, nbindBuffer);
