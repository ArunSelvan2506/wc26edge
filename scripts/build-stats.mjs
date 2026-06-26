// Build real World Cup statistical baselines from openfootball public-domain data.
// Source: https://github.com/openfootball/worldcup.json  (CC0 / public domain)
// Usage: node scripts/build-stats.mjs  -> writes data/worldcup-stats.json
const YEARS = [1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022];
const BASE = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master';

const isGroup = (m) => /^(Matchday|Group)/i.test(m.round || '') || !!m.group;
const ft = (m) => (m.score && Array.isArray(m.score.ft)) ? m.score.ft : null;

async function fetchYear(y) {
  const r = await fetch(`${BASE}/${y}/worldcup.json`);
  if (!r.ok) throw new Error(`${y}: HTTP ${r.status}`);
  return r.json();
}

const per = [];
let G = { matches:0, goals:0, over25:0, btts:0, gMatches:0, draws:0 };

for (const y of YEARS) {
  const d = await fetchYear(y);
  const ms = d.matches || [];
  let t = { year:y, matches:0, goals:0, over25:0, btts:0, gMatches:0, draws:0 };
  for (const m of ms) {
    const f = ft(m); if (!f) continue;
    const tot = f[0] + f[1];
    t.matches++; t.goals += tot;
    if (tot >= 3) t.over25++;
    if (f[0] > 0 && f[1] > 0) t.btts++;
    if (isGroup(m)) { t.gMatches++; if (f[0] === f[1]) t.draws++; }
  }
  per.push({
    year:y, matches:t.matches,
    goalsPerGame:+(t.goals/t.matches).toFixed(2),
    over25Pct:Math.round(t.over25/t.matches*100),
    bttsPct:Math.round(t.btts/t.matches*100),
    drawPct: t.gMatches? Math.round(t.draws/t.gMatches*100): null,
  });
  G.matches+=t.matches; G.goals+=t.goals; G.over25+=t.over25; G.btts+=t.btts; G.gMatches+=t.gMatches; G.draws+=t.draws;
}

const recent = per.filter(p=>p.year>=1998); // modern 32+/48-team era
const recAgg = recent.reduce((a,p)=>{a.g+=p.goalsPerGame*p.matches;a.m+=p.matches;return a;},{g:0,m:0});
const last3 = per.slice(-3); // most recent 3 tournaments = current scoring era
const avg = (arr,k)=>+(arr.reduce((a,p)=>a+p[k],0)/arr.length).toFixed(2);

const modernEra = {
  fromYear: 1998,
  goalsPerGame: +(recAgg.g/recAgg.m).toFixed(2),
  over25Pct: Math.round(recent.reduce((a,p)=>a+p.over25Pct,0)/recent.length),
  bttsPct: Math.round(recent.reduce((a,p)=>a+p.bttsPct,0)/recent.length),
  drawPct: Math.round(recent.reduce((a,p)=>a+(p.drawPct||0),0)/recent.length),
};

// Forward baseline used by the app's confidence logic: the current scoring era
// (last 3 World Cups) is the best prior for WC 2026 expectations.
const baseline = {
  basis: `mean of ${last3.map(p=>p.year).join(', ')}`,
  goalsPerGame: avg(last3,'goalsPerGame'),
  over25Pct: Math.round(avg(last3,'over25Pct')),
  bttsPct: Math.round(avg(last3,'bttsPct')),
  drawPct: Math.round(avg(last3,'drawPct')),
};

const out = {
  source: 'openfootball/worldcup.json (public domain / CC0)',
  generated: '2026-06-26',
  tournaments: per.length,
  allTime: {
    matches: G.matches,
    goalsPerGame: +(G.goals/G.matches).toFixed(2),
    over25Pct: Math.round(G.over25/G.matches*100),
    bttsPct: Math.round(G.btts/G.matches*100),
    drawPct: Math.round(G.draws/G.gMatches*100),
  },
  modernEra,
  baseline,
  perTournament: per,
};
import('fs').then(fs=>fs.writeFileSync('data/worldcup-stats.json', JSON.stringify(out,null,2)));
console.log(JSON.stringify(out,null,2));
