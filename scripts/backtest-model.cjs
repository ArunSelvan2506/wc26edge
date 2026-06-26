/* ───────────────────────────────────────────────────────────────────────────
   WC26 EDGE · Calibration backtest
   ───────────────────────────────────────────────────────────────────────────
   Leave-one-out (LOO): for every completed match, refit the ratings on every
   OTHER match, predict the held-out one, and grade it. This measures whether
   the model is calibrated ("does 70% actually happen ~70% of the time?") and
   how it scores vs a naive base-rate baseline.

   Metrics:
     • Brier score  — mean squared error of probabilities (lower = better)
     • Log loss      — penalises confident wrongness (lower = better)
     • Reliability   — predicted-prob buckets vs observed frequency

   NOTE: LOO uses all other matches (past AND future), so it tests fit quality,
   not live forward-prediction skill (which needs a longer match history than a
   single group stage of openfootball seed data). Treated as a calibration check.

   Usage: node scripts/backtest-model.cjs   (writes data/backtest.json)
   ─────────────────────────────────────────────────────────────────────────── */
const fs = require('fs');
const M = require('./wc-model.cjs');

const data = JSON.parse(fs.readFileSync('data/worldcup-results.json', 'utf8'));
let all = [];
for (const g in data.groups) all = all.concat(data.groups[g].results || []);
all = all.filter(r => Number.isFinite(r.s1) && Number.isFinite(r.s2));

// empirical base rates over the sample (the naive baseline to beat)
let nH = 0, nD = 0, nA = 0, nOver = 0, nBtts = 0;
for (const r of all) {
  if (r.s1 > r.s2) nH++; else if (r.s1 === r.s2) nD++; else nA++;
  if (r.s1 + r.s2 >= 3) nOver++;
  if (r.s1 >= 1 && r.s2 >= 1) nBtts++;
}
const N = all.length;
const base = { home: nH / N, draw: nD / N, away: nA / N, over: nOver / N, btts: nBtts / N };

const clip = p => Math.min(1 - 1e-9, Math.max(1e-9, p));
const acc = () => ({ brier: 0, ll: 0, n: 0, buckets: Array.from({ length: 10 }, () => ({ p: 0, y: 0, n: 0 })) });
function addBinary(a, p, y) {
  a.brier += (p - y) ** 2;
  a.ll += -(y * Math.log(clip(p)) + (1 - y) * Math.log(clip(1 - p)));
  const b = a.buckets[Math.min(9, Math.floor(p * 10))];
  b.p += p; b.y += y; b.n++;
  a.n++;
}

const model = { x2: { brier: 0, ll: 0, n: 0 }, over: acc(), btts: acc() };
const naive = { x2: { brier: 0, ll: 0, n: 0 }, over: acc(), btts: acc() };

for (let i = 0; i < N; i++) {
  const test = all[i];
  const train = all.filter((_, j) => j !== i);
  const rat = M.fitRatings(train, { priorGoals: 1.30 });
  const m = M.markets(rat, test.t1, test.t2);

  const yH = test.s1 > test.s2 ? 1 : 0, yD = test.s1 === test.s2 ? 1 : 0, yA = test.s1 < test.s2 ? 1 : 0;
  const yOver = test.s1 + test.s2 >= 3 ? 1 : 0, yBtts = (test.s1 >= 1 && test.s2 >= 1) ? 1 : 0;

  // multiclass 1X2 Brier + log loss
  model.x2.brier += (m.home - yH) ** 2 + (m.draw - yD) ** 2 + (m.away - yA) ** 2;
  model.x2.ll += -Math.log(clip(yH ? m.home : yD ? m.draw : m.away));
  model.x2.n++;
  naive.x2.brier += (base.home - yH) ** 2 + (base.draw - yD) ** 2 + (base.away - yA) ** 2;
  naive.x2.ll += -Math.log(clip(yH ? base.home : yD ? base.draw : base.away));
  naive.x2.n++;

  addBinary(model.over, m.over25, yOver);
  addBinary(model.btts, m.btts, yBtts);
  addBinary(naive.over, base.over, yOver);
  addBinary(naive.btts, base.btts, yBtts);
}

const fin = a => ({ brier: +(a.brier / a.n).toFixed(4), ll: +(a.ll / a.n).toFixed(4) });
const finB = a => ({
  brier: +(a.brier / a.n).toFixed(4), ll: +(a.ll / a.n).toFixed(4),
  reliability: a.buckets.filter(b => b.n).map(b => ({
    range: (Math.round(b.p / b.n * 100)) + '%pred', predMean: +(b.p / b.n).toFixed(2),
    obsFreq: +(b.y / b.n).toFixed(2), n: b.n,
  })),
});

const out = {
  source: data.source, matches: N, baseRates: base,
  model: { x2: fin(model.x2), over25: finB(model.over), btts: finB(model.btts) },
  naive: { x2: fin(naive.x2), over25: fin(naive.over), btts: fin(naive.btts) },
  note: 'Leave-one-out calibration over openfootball seed results. Lower Brier/LL = better. Model should beat the naive base-rate baseline.',
};
fs.writeFileSync('data/backtest.json', JSON.stringify(out, null, 2));

// ── console summary ──
const pct = x => (x * 100).toFixed(0) + '%';
console.log(`\nLOO backtest over ${N} matches`);
console.log(`base rates: H ${pct(base.home)} D ${pct(base.draw)} A ${pct(base.away)} | O2.5 ${pct(base.over)} | BTTS ${pct(base.btts)}\n`);
const row = (name, mdl, nv) => console.log(
  `  ${name.padEnd(10)} Brier ${mdl.brier.toFixed(3)} (base ${nv.brier.toFixed(3)})   LogLoss ${mdl.ll.toFixed(3)} (base ${nv.ll.toFixed(3)})   ${mdl.brier < nv.brier ? '✓ beats baseline' : '✗ worse than baseline'}`);
row('1X2', out.model.x2, out.naive.x2);
row('Over 2.5', out.model.over25, out.naive.over25);
row('BTTS', out.model.btts, out.naive.btts);
console.log('\nOver 2.5 reliability (predicted → observed):');
out.model.over25.reliability.forEach(b => console.log(`  ~${b.predMean} predicted → ${b.obsFreq} observed  (n=${b.n})`));
console.log('\nwrote data/backtest.json');
