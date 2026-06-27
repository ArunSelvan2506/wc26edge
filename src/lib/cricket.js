// Cricket match-winner model (no external odds feed). Win probabilities come
// from curated, format-specific strength ratings (approx ICC ranking points,
// hand-seeded — illustrative, not official) run through a logistic, then turned
// into fair odds. Tests carry a draw outcome; limited-overs are two-way.
// Also: recent form, a score predictor with an over/under runs line, plus
// easy-bet and value-parlay helpers — same easy/value theme as the football side.
import { amToDec } from './odds.js';

// Strength ratings (approx ICC ranking points, hand-seeded — illustrative,
// not official), split by gender and format.
const RATINGS = {
  men: {
    test: {
      Australia: 124, India: 120, England: 113, 'South Africa': 105, 'New Zealand': 100,
      'Sri Lanka': 95, Pakistan: 88, 'West Indies': 76, Bangladesh: 60, Afghanistan: 55,
      Ireland: 35, Zimbabwe: 30,
    },
    odi: {
      India: 122, Australia: 116, 'South Africa': 110, 'New Zealand': 104, Pakistan: 100,
      England: 98, 'Sri Lanka': 92, Afghanistan: 88, Bangladesh: 82, 'West Indies': 78,
      Ireland: 55, Zimbabwe: 50, Netherlands: 48, Scotland: 45, Nepal: 42,
    },
    t20i: {
      India: 270, Australia: 258, England: 252, 'West Indies': 248, 'South Africa': 246,
      Pakistan: 240, 'New Zealand': 235, Afghanistan: 228, 'Sri Lanka': 220, Bangladesh: 210,
      Ireland: 190, Zimbabwe: 180, Netherlands: 175, Nepal: 170, Scotland: 165, USA: 150,
      'United Arab Emirates': 145, Canada: 135, Namibia: 140, Oman: 138,
    },
  },
  women: {
    test: {
      Australia: 130, England: 115, India: 110, 'South Africa': 95,
    },
    odi: {
      Australia: 167, England: 130, India: 124, 'South Africa': 110, 'New Zealand': 105,
      'West Indies': 95, Pakistan: 80, 'Sri Lanka': 86, Bangladesh: 70, Ireland: 50, Scotland: 40,
    },
    t20i: {
      Australia: 290, England: 270, India: 258, 'South Africa': 250, 'New Zealand': 245,
      'West Indies': 235, Pakistan: 220, 'Sri Lanka': 215, Bangladesh: 200, Ireland: 175,
      Scotland: 160, 'United Arab Emirates': 150, Thailand: 145, Netherlands: 140,
    },
  },
};

// Backward-compatible export (men's tables) + a flat list of every nation.
export const CRICKET_RATINGS = RATINGS.men;
export const CRICKET_NATIONS = [...new Set(
  Object.values(RATINGS).flatMap(g => Object.values(g)).flatMap(o => Object.keys(o))
)];

const SPREAD = { test: 22, odi: 38, t20i: 48 };   // logistic scale per format
// (tuned so a ~25-pt ICC gap ≈ 65% favourite; top-vs-minnow ≈ 90%)
const DRAW_BASE = 0.27;                           // Test draw rate when evenly matched

const ALIAS = {
  uae: 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates', usa: 'USA',
  'united states': 'USA', windies: 'West Indies', 'sl': 'Sri Lanka',
  rsa: 'South Africa', nz: 'New Zealand',
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const avg = obj => { const v = Object.values(obj); return v.reduce((s, x) => s + x, 0) / v.length; };

// Display name: women's sides always show a " W" suffix (model lookups use the
// bare nation name, so this is purely cosmetic).
export const teamLabel = (name, gender) => (gender === 'women' ? `${name} W` : name);

export function fmtKey(format) {
  const f = String(format || '').toLowerCase();
  if (f.includes('test')) return 'test';
  if (f.includes('odi') || f.includes('one day') || f.includes('one-day')) return 'odi';
  return 't20i';
}
export const FORMAT_LABEL = { test: 'Test', odi: 'ODI', t20i: 'T20I' };

function rating(table, team) {
  if (team == null) return avg(table);
  if (table[team] != null) return table[team];
  const a = ALIAS[String(team).toLowerCase()];
  if (a && table[a] != null) return table[a];
  return avg(table);
}

// Full match-winner market: { format, pA, pB, pDraw, oddsA, oddsB, oddsDraw }.
// Probabilities sum to 1; odds are fair (no book margin), American canonical.
export function cricketMarket(teamA, teamB, format, gender = 'men') {
  const f = fmtKey(format);
  const tables = RATINGS[gender] || RATINGS.men;
  const table = tables[f] || tables.t20i;
  const ra = rating(table, teamA), rb = rating(table, teamB);
  const pAraw = 1 / (1 + Math.exp(-(ra - rb) / SPREAD[f]));   // P(A wins | no draw)
  let pA, pB, pDraw = 0;
  if (f === 'test') {
    pDraw = clamp(DRAW_BASE * (1 - Math.abs(pAraw - 0.5) * 1.4), 0.05, 0.35);
    pA = pAraw * (1 - pDraw);
    pB = (1 - pAraw) * (1 - pDraw);
  } else {
    pA = pAraw; pB = 1 - pAraw;
  }
  return {
    format: f, ra, rb, pA, pB, pDraw,
    oddsA: probToAmerican(pA), oddsB: probToAmerican(pB),
    oddsDraw: pDraw ? probToAmerican(pDraw) : null,
  };
}

// Fair probability → American odds string ("+150" / "-180").
export function probToAmerican(p) {
  if (!p || p <= 0 || p >= 1) return null;
  const dec = 1 / p;
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) : '-' + Math.round(100 / (dec - 1));
}

/* ── Recent form (curated last-5, newest first; W win / L loss / D draw / N no result) ── */
export const CRICKET_FORM = {
  men: {
    India: ['W', 'W', 'L', 'W', 'W'], Australia: ['W', 'L', 'W', 'W', 'W'],
    England: ['L', 'W', 'W', 'L', 'W'], 'South Africa': ['W', 'W', 'W', 'L', 'L'],
    'New Zealand': ['W', 'L', 'W', 'L', 'W'], Pakistan: ['L', 'W', 'L', 'W', 'L'],
    'Sri Lanka': ['W', 'L', 'L', 'W', 'L'], Afghanistan: ['W', 'W', 'L', 'L', 'W'],
    Bangladesh: ['L', 'L', 'W', 'L', 'W'], 'West Indies': ['L', 'W', 'L', 'L', 'W'],
  },
  women: {
    Australia: ['W', 'W', 'W', 'W', 'L'], England: ['W', 'L', 'W', 'W', 'L'],
    India: ['W', 'W', 'L', 'W', 'L'], 'South Africa': ['L', 'W', 'W', 'L', 'W'],
    'New Zealand': ['L', 'W', 'L', 'W', 'L'], 'West Indies': ['L', 'L', 'W', 'L', 'W'],
  },
};
export function cricketForm(team, gender = 'men') {
  const t = (CRICKET_FORM[gender] || CRICKET_FORM.men)[team];
  if (t) return t;
  const a = ALIAS[String(team).toLowerCase()];
  return (a && (CRICKET_FORM[gender] || CRICKET_FORM.men)[a]) || null;
}

/* ── Score predictor + over/under (limited-overs only) ── */
const PAR = { t20i: 165, odi: 260 };                 // per-innings batting par
const TOT_SD = { t20i: 30, odi: 46 };                // SD of match total
const MEAN_R = { men: { t20i: 215, odi: 88 }, women: { t20i: 230, odi: 100 } };
const GAP_COEF = { t20i: 0.16, odi: 0.28 };          // runs per rating point (innings split)
const QTILT = { t20i: 34, odi: 50 };                 // how much overall quality lifts totals

function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Returns { format, total1, total2, matchTotal, line, pOver, pUnder, oddsOver, oddsUnder }
// or null for Tests (no runs O/U).
export function projectScores(teamA, teamB, format, gender = 'men') {
  const f = fmtKey(format);
  if (f === 'test') return null;
  const tables = RATINGS[gender] || RATINGS.men;
  const table = tables[f] || tables.t20i;
  const ra = rating(table, teamA), rb = rating(table, teamB);
  const meanR = (MEAN_R[gender] || MEAN_R.men)[f];
  const quality = (((ra + rb) / 2) - meanR) / SPREAD[f];          // matchup quality vs par
  const matchTotal = 2 * PAR[f] + quality * QTILT[f];
  const gapAdj = clamp((ra - rb) * GAP_COEF[f], -PAR[f] * 0.22, PAR[f] * 0.22);
  const total1 = Math.round(matchTotal / 2 + gapAdj / 2);
  const total2 = Math.round(matchTotal - total1);
  const line = Math.round(2 * PAR[f]) + 0.5;                      // standard par line
  const z = (line - matchTotal) / TOT_SD[f];
  const pUnder = clamp(normCdf(z), 0.02, 0.98), pOver = 1 - pUnder;
  return {
    format: f, total1, total2, matchTotal: Math.round(matchTotal), line,
    pOver, pUnder, oddsOver: probToAmerican(pOver), oddsUnder: probToAmerican(pUnder),
  };
}

// Easy bets (high-confidence picks) + the model market + score for a fixture.
export function cricketBets(m) {
  const gender = m.gender === 'women' ? 'women' : 'men';
  const mk = cricketMarket(m.t1, m.t2, m.format, gender);
  const fav = mk.pA >= mk.pB ? { team: m.t1, p: mk.pA, o: mk.oddsA } : { team: m.t2, p: mk.pB, o: mk.oddsB };
  fav.label = teamLabel(fav.team, gender);
  const sc = projectScores(m.t1, m.t2, m.format, gender);
  const easy = [{ c: 'Match winner', p: `${fav.label} to win`, cf: Math.round(fav.p * 100), o: fav.o, star: fav.p >= 0.65 }];
  if (sc) {
    const over = sc.pOver >= sc.pUnder;
    easy.push({
      c: 'Total runs', p: `${over ? 'Over' : 'Under'} ${sc.line} match runs`,
      cf: Math.round((over ? sc.pOver : sc.pUnder) * 100), o: over ? sc.oddsOver : sc.oddsUnder,
      star: Math.max(sc.pOver, sc.pUnder) >= 0.6,
    });
  }
  return { mk, fav, sc, easy };
}

// Two-leg value parlay: match winner + total runs over/under.
export function cricketParlay(m) {
  const { fav, sc } = cricketBets(m);
  const legs = [{ p: `${fav.label} to win`, o: fav.o, prob: fav.p }];
  if (sc) {
    const over = sc.pOver >= sc.pUnder;
    legs.push({ p: `${over ? 'Over' : 'Under'} ${sc.line} runs`, o: over ? sc.oddsOver : sc.oddsUnder, prob: over ? sc.pOver : sc.pUnder });
  }
  const prob = legs.reduce((a, l) => a * l.prob, 1);
  const dec = legs.reduce((a, l) => a * (amToDec(l.o) || 1), 1);
  return { legs, prob, dec };
}
