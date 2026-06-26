/* Inject scripts/wc-model.cjs into index.html between the WCMODEL markers, so
   the runtime page and the calibration backtest share one source of truth.
   Usage: node scripts/build-model.cjs */
const fs = require('fs');

const model = fs.readFileSync('scripts/wc-model.cjs', 'utf8').trim();
let html = fs.readFileSync('index.html', 'utf8');

const START = '/*WCMODEL:START*/', END = '/*WCMODEL:END*/';
const i = html.indexOf(START), j = html.indexOf(END);
if (i < 0 || j < 0 || j < i) { console.error('WCMODEL markers not found in index.html'); process.exit(1); }

const block = START + '\n' + model + '\n' + END;
html = html.slice(0, i) + block + html.slice(j + END.length);
fs.writeFileSync('index.html', html);
console.log('Injected wc-model.cjs (' + model.length + ' chars) into index.html');
