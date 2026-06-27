// Cricket match-winner model (no external odds feed). Win probabilities come
// from curated, format-specific strength ratings (approx ICC ranking points,
// hand-seeded — illustrative, not official) run through a logistic, then turned
// into fair odds. Tests carry a draw outcome; limited-overs are two-way.

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
