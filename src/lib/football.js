// Football match engine — derives foul / card / corner / shot props for ANY
// fixture from the opponent-adjusted model (team strength + form via ratings)
// plus World Cup baselines. No per-player curation, so it applies to every
// knockout tie automatically. All fair odds (no book margin).
import { markets } from './model.js';
import { probToAm } from './sportEngine.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const line5 = x => Math.floor(x) + 0.5;                 // nearest X.5 line below the mean
function ncdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const pOver = (line, mean, sd) => clamp(1 - ncdf((line - mean) / sd), 0.04, 0.96);

// One over/under market → the leaning side with model prob + fair odds.
function ou(label, mean, sd) {
  const line = line5(mean);
  const po = pOver(line, mean, sd);
  const over = po >= 0.5;
  const prob = over ? po : 1 - po;
  return { label, line, side: over ? 'Over' : 'Under', prob, am: probToAm(prob) };
}

// Poisson P(X > line) for low-count player markets (fouls per player).
function poisOver(line, mean) {
  const k = Math.floor(line);
  let cum = 0, term = Math.exp(-mean);
  for (let i = 0; i <= k; i++) { cum += term; term *= mean / (i + 1); }
  return clamp(1 - cum, 0.04, 0.96);
}

// Foul rate (per 90) by playing position. Defensive mids / full-backs foul most.
function posFoulRate(pos) {
  const s = String(pos || '').toLowerCase();
  if (/keeper|goalie|\bgk\b/.test(s)) return 0.1;
  if (/def.*mid|\bcdm\b|\bdm\b|holding/.test(s)) return 2.0;
  if (/centre.?back|center.?back|\bcb\b/.test(s)) return 1.7;
  if (/back|\blb\b|\brb\b|\bwb\b|wing.?back/.test(s)) return 1.6;
  if (/defen/.test(s)) return 1.7;
  if (/att.*mid|\bam\b/.test(s)) return 1.2;
  if (/wing|\blm\b|\brm\b/.test(s)) return 1.05;
  if (/mid/.test(s)) return 1.5;
  if (/forward|strik|strike|\bcf\b|\bst\b/.test(s)) return 0.9;
  return 1.3;
}

// One player foul prop from a foul rate (per 90) → leaning side + fair odds.
function foulProp(who, rate) {
  const line = Math.max(0.5, line5(rate));
  const po = poisOver(line, rate);
  const over = po >= 0.5;
  const prob = over ? po : 1 - po;
  return { who, label: 'fouls committed', line, side: over ? 'Over' : 'Under', prob, am: probToAm(prob), rate };
}

// Build player foul props for one side. Uses the real XI (named players, by
// position) when a lineup is baked; otherwise role archetypes so every fixture
// still gets picks — names lock in once the lineup is confirmed.
function sideFoulProps(team, teamFouls, lineupSide) {
  const factor = teamFouls / 12;                         // baseline ~12 fouls / team
  const xi = lineupSide && Array.isArray(lineupSide.players)
    ? lineupSide.players.filter(p => !p.sub) : [];
  if (xi.length >= 6) {
    return xi
      .map(p => ({ who: p.name, rate: posFoulRate(p.pos) * factor }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map(p => foulProp(p.who, p.rate));
  }
  // Role archetypes (no XI yet).
  return [
    { who: `${team} defensive mid`, rate: 2.0 * factor },
    { who: `${team} full-back`, rate: 1.6 * factor },
    { who: `${team} centre-back`, rate: 1.7 * factor },
  ].map(r => foulProp(r.who, r.rate));
}

export function footballEngine(rat, a, c, lineup) {
  const mk = markets(rat, a, c);
  const la = mk.lh, lb = mk.la;                          // expected goals (form-adjusted)
  // Shots on target scale with expected goals; fouls/cards rise in tight ties.
  const sotA = clamp(2.2 + la * 2.1, 1.2, 9);
  const sotC = clamp(2.2 + lb * 2.1, 1.2, 9);
  const tight = 1 - Math.abs(mk.home - mk.away);         // 0 = mismatch, 1 = even
  const foulsTot = 23 + tight * 4;                       // WC baseline ~24/match
  const cardsTot = clamp(foulsTot / 6 + 0.9, 3, 7);      // knockout tension
  const cornTot = 10.4 + Math.max(la, lb) * 0.6;         // WC baseline ~10.6

  const props = {
    fouls: ou('total fouls', foulsTot, 4.6),
    cards: ou('total cards', cardsTot, 1.8),
    corners: ou('total corners', cornTot, 3.2),
    sot: ou('total shots on target', sotA + sotC, 3.0),
    sotA: ou(`${a} shots on target`, sotA, 1.8),
    sotC: ou(`${c} shots on target`, sotC, 1.8),
  };

  // Per-team foul split — the side less likely to win presses & fouls more.
  const foulsA = clamp(foulsTot * (0.5 + (mk.away - mk.home) * 0.15), foulsTot * 0.4, foulsTot * 0.6);
  const playerFouls = {
    named: !!(lineup && ((lineup.a?.players?.length || 0) >= 6 || (lineup.b?.players?.length || 0) >= 6)),
    a: sideFoulProps(a, foulsA, lineup?.a),
    c: sideFoulProps(c, foulsTot - foulsA, lineup?.b),
  };

  const fav = mk.home >= mk.away ? { n: a, p: mk.home } : { n: c, p: mk.away };
  const dog = mk.home >= mk.away ? { n: c, p: mk.away } : { n: a, p: mk.home };
  const goalsP = Math.max(mk.over25, 1 - mk.over25), goalsOver = mk.over25 >= 0.5;
  const bttsP = Math.max(mk.btts, 1 - mk.btts), bttsYes = mk.btts >= 0.5;

  // Candidate legs for safe / value parlay selection (split by odds downstream).
  const legs = [
    { p: `${fav.n} to win`, prob: fav.p, am: probToAm(fav.p) },
    { p: `${dog.n} to win`, prob: dog.p, am: probToAm(dog.p) },
    { p: `${goalsOver ? 'Over' : 'Under'} 2.5 goals`, prob: goalsP, am: probToAm(goalsP) },
    { p: `BTTS ${bttsYes ? 'Yes' : 'No'}`, prob: bttsP, am: probToAm(bttsP) },
    ...Object.values(props).map(o => ({ p: `${o.side} ${o.line} ${o.label}`, prob: o.prob, am: o.am })),
    ...[...playerFouls.a, ...playerFouls.c].map(o => ({ p: `${o.who} ${o.side} ${o.line} ${o.label}`, prob: o.prob, am: o.am })),
  ];
  return { mk, props, playerFouls, fav, dog, legs };
}
