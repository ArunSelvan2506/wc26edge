// Football match engine — derives foul / card / corner / shot props for ANY
// fixture from the opponent-adjusted model (team strength + form via ratings)
// plus World Cup baselines. No per-player curation, so it applies to every
// knockout tie automatically. All fair odds (no book margin).
import { markets, pois } from './model.js';
import { probToAm } from './sportEngine.js';

// Knockout football is tighter than the group stage — sides are more cautious,
// chances dry up and ties drift toward extra time / penalties. We trim the
// group-stage goal expectation rather than carry it straight in.
const KO_DAMP = 0.86;
const pcN = x => Math.round(x * 100);
// P(total goals > line) for a Poisson total with mean mu (line = n + 0.5).
function poisTotalOver(mu, n) {
  let cum = 0; for (let k = 0; k <= n; k++) cum += pois(mu, k);
  return clamp(1 - cum, 0.04, 0.96);
}
// Bet/Lean/Pass from model confidence — never "safe", never a guarantee.
const verdictOf = p => (p >= 0.62 ? 'Bet' : p >= 0.55 ? 'Lean' : 'Pass');

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

// One player foul prop → "1+ foul" (Over 0.5) only. The confidence is the
// player's last-10 hit rate: in how many of his last ~10 matches he committed
// at least one foul, P(≥1 foul) = 1 − e^(−rate) modelled from his role & the
// match context (free feeds don't carry per-match player foul logs).
function foulProp(who, rate) {
  const prob = poisOver(0.5, rate);                 // P(≥1 foul) = 1 − e^(−rate)
  const hits = Math.max(1, Math.min(10, Math.round(prob * 10)));
  return { who, label: 'fouls committed', line: 0.5, side: 'Over', prob, hits, am: probToAm(prob), rate };
}

// Pick the top-3 foul-rate players from a list of {name, pos}, scaled by the
// side's projected fouls. Returns prop rows.
function namedFoulProps(players, factor) {
  return players
    .map(p => ({ who: p.name, rate: posFoulRate(p.pos) * factor }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map(p => foulProp(p.who, p.rate));
}

// Build player foul props for one side, best source first:
//   confirmed XI (lineup baked near KO) → squad roster (projected names) →
//   role archetypes (always available). Returns { props, source }.
function sideFoulProps(team, teamFouls, lineupSide, squadSide) {
  const factor = teamFouls / 12;                         // baseline ~12 fouls / team
  const xi = lineupSide && Array.isArray(lineupSide.players)
    ? lineupSide.players.filter(p => !p.sub) : [];
  if (xi.length >= 6) return { props: namedFoulProps(xi, factor), source: 'confirmed' };
  if (Array.isArray(squadSide) && squadSide.length) return { props: namedFoulProps(squadSide, factor), source: 'projected' };
  const roles = [
    { who: `${team} defensive mid`, rate: 2.0 * factor },
    { who: `${team} full-back`, rate: 1.6 * factor },
    { who: `${team} centre-back`, rate: 1.7 * factor },
  ].map(r => foulProp(r.who, r.rate));
  return { props: roles, source: 'role' };
}

export function footballEngine(rat, a, c, lineup, squads) {
  const mk = markets(rat, a, c);
  // Knockout-trimmed goal expectation — DON'T carry the group-stage number in.
  const la = mk.lh * KO_DAMP, lb = mk.la * KO_DAMP;
  const muTot = la + lb;                                  // projected total goals (90 min)
  const over25 = poisTotalOver(muTot, 2);                 // re-derived, not the group figure
  const bttsYes = clamp((1 - Math.exp(-la)) * (1 - Math.exp(-lb)), 0.04, 0.96);

  // Shots dry up when sides are cautious; fouls/cards rise in a tense KO tie.
  const sotA = clamp(2.0 + la * 2.0, 1.0, 8.5);
  const sotC = clamp(2.0 + lb * 2.0, 1.0, 8.5);
  const tight = 1 - Math.abs(mk.home - mk.away);          // 0 = mismatch, 1 = even
  const foulsTot = 25 + tight * 4;                        // tactical, niggly knockouts
  const cardsTot = clamp(foulsTot / 5.5 + 1.0, 3.2, 7.5); // more cards under pressure
  const cornTot = 9.6 + Math.max(la, lb) * 0.6;           // fewer (cautious) than groups

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
  const sideA = sideFoulProps(a, foulsA, lineup?.a, squads?.a);
  const sideC = sideFoulProps(c, foulsTot - foulsA, lineup?.b, squads?.c);
  const rank = { confirmed: 3, projected: 2, role: 1 };
  const mode = rank[sideA.source] >= rank[sideC.source] ? sideA.source : sideC.source;
  const playerFouls = { mode, a: sideA.props, c: sideC.props };

  const fav = mk.home >= mk.away ? { n: a, p: mk.home } : { n: c, p: mk.away };
  const dog = mk.home >= mk.away ? { n: c, p: mk.away } : { n: a, p: mk.home };
  const goalsP = Math.max(over25, 1 - over25), goalsOver = over25 >= 0.5;
  const bttsP = Math.max(bttsYes, 1 - bttsYes), bttsY = bttsYes >= 0.5;

  const ko = { la, lb, muTot, over25, bttsYes, etRisk: mk.draw };
  const script = gameScript(mk, ko, fav, dog, a, c);
  const radar = upsetRadar(mk, ko, fav, dog);

  const legs = [
    { p: `${fav.n} to win`, prob: fav.p, am: probToAm(fav.p) },
    { p: `${dog.n} to win`, prob: dog.p, am: probToAm(dog.p) },
    { p: `${goalsOver ? 'Over' : 'Under'} 2.5 goals`, prob: goalsP, am: probToAm(goalsP) },
    { p: `BTTS ${bttsY ? 'Yes' : 'No'}`, prob: bttsP, am: probToAm(bttsP) },
    ...Object.values(props).map(o => ({ p: `${o.side} ${o.line} ${o.label}`, prob: o.prob, am: o.am })),
    ...[...playerFouls.a, ...playerFouls.c].map(o => ({ p: `${o.who} ${o.side} ${o.line} ${o.label}`, prob: o.prob, am: o.am })),
  ];
  return { mk, ko, props, playerFouls, fav, dog, script, radar, legs };
}

// Game-script read — how the tie is likely to play, with a Bet/Lean/Pass verdict
// per market. Confidence only; never a guarantee, never "safe".
function gameScript(mk, ko, fav, dog, a, c) {
  const cautious = ko.muTot < 2.5;
  const coinFlip = Math.abs(mk.home - mk.away) < 0.08;
  const etPct = pcN(ko.etRisk);
  const lines = [
    `${cautious ? 'Both sides likely cautious' : 'Open-ish for a knockout'} — projected total ~${ko.muTot.toFixed(1)} goals (group-stage expectation trimmed for a tighter tie).`,
    coinFlip
      ? `True coin-flip on paper — neither side is clearly forced to chase.`
      : `${dog.n} has to take the risks; ${fav.n} can sit on a lead and trust the defence.`,
    `Extra-time / penalties risk ${etPct}/100 — ${ko.etRisk > 0.27 ? 'a real chance it drags past 90' : 'should be settled inside 90'}.`,
    `Lineups unconfirmed — rotation and heavy legs from the group stage can't be fully priced yet.`,
  ];
  const winConf = coinFlip ? fav.p : fav.p;
  const goalsConf = Math.max(ko.over25, 1 - ko.over25);
  const bttsConf = Math.max(ko.bttsYes, 1 - ko.bttsYes);
  const markets = [
    { m: 'Match winner', pick: `${fav.n} to win`, conf: pcN(fav.p), verdict: coinFlip ? 'Pass' : verdictOf(fav.p), note: coinFlip ? 'coin flip — no edge' : 'lineups can shift this' },
    { m: 'Total goals', pick: `${ko.over25 >= 0.5 ? 'Over' : 'Under'} 2.5`, conf: pcN(goalsConf), verdict: cautious && ko.over25 < 0.5 ? verdictOf(goalsConf) : verdictOf(goalsConf), note: 'knockout-trimmed' },
    { m: 'Both teams score', pick: `BTTS ${ko.bttsYes >= 0.5 ? 'Yes' : 'No'}`, conf: pcN(bttsConf), verdict: verdictOf(bttsConf), note: 'tight tie favours No' },
  ];
  return { cautious, coinFlip, lines, markets };
}

// Upset-risk radar — favourite vulnerability, the underdog's path, the style
// clash, and an honest verdict (sometimes the favourite just cruises).
function upsetRadar(mk, ko, fav, dog) {
  const favVuln = [];
  if (ko.muTot < 2.5) favVuln.push('a low-event tie limits how often the favourite can assert quality');
  if (fav.p < 0.66) favVuln.push('not dominant on paper — margins are thin');
  if (ko.etRisk > 0.27) favVuln.push('high draw chance funnels the tie toward a penalty lottery');
  favVuln.push('rotation / key absences unconfirmed');
  const dogPath = (ko.muTot < 2.5 || ko.etRisk > 0.27)
    ? 'Sit deep, stay compact, hit on the break — and be happy to take it to penalties.'
    : 'Needs an early goal and a near-perfect night to live with the favourite.';
  const gap = fav.p - dog.p;
  const clash = gap < 0.18 ? 'Closely matched — small margins decide it.'
    : gap < 0.4 ? 'Favourite is stronger but beatable on the day.'
      : 'Favourite stronger across the pitch.';
  let verdict, live;
  if (fav.p >= 0.72) { verdict = `Favourite should cruise — the upset is unlikely and ${dog.n}'s price is fair, not value.`; live = false; }
  else if (dog.p >= 0.33 && (ko.muTot < 2.5 || ko.etRisk > 0.27)) { verdict = `Live upset spot — a low-event tie plus penalty risk gives ${dog.n} a genuine path.`; live = true; }
  else { verdict = `Fair — ${fav.n} is rightly priced; no standout upset edge.`; live = false; }
  return { fav: fav.n, dog: dog.n, favVuln, dogPath, clash, verdict, live, upsetPct: pcN(dog.p) };
}
