// Shared engine for the head-to-head sports (Tennis, Basketball) and F1 races.
// No external feed — ratings/form/props/injuries are curated (illustrative),
// win probabilities are model-derived, odds are fair (no book margin).

export const dec = am => {
  const n = parseFloat(String(am).replace(/[^\-+0-9.]/g, ''));
  if (!isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
};
export const probToAm = p => {
  if (!p || p <= 0 || p >= 1) return null;
  const d = 1 / p;
  return d >= 2 ? '+' + Math.round((d - 1) * 100) : '-' + Math.round(100 / (d - 1));
};
export const winProb = (ra, rb, spread) => 1 / (1 + Math.exp(-((ra - rb) / spread)));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Bet thresholds (decimal odds).
export const SAFE_MAX = 1.75;   // safe parlay legs: short-priced favourites
export const VALUE_MIN = 4.0;   // value parlay legs: longshots / big payout

// Combine a set of legs into a parlay { legs, prob, dec }.
function combine(legs) {
  const prob = legs.reduce((a, l) => a * l.prob, 1);
  const d = legs.reduce((a, l) => a * (l.dec || dec(l.am) || 1), 1);
  return { legs, prob, dec: d };
}

// Pick up to `max` distinct-tag legs from a sorted pool (no two legs from the
// same match / event). Falls back to `p` text when a leg has no tag.
function distinct(pool, max) {
  const seen = new Set(), out = [];
  for (const l of pool) { const k = l.tag || l.p; if (seen.has(k)) continue; seen.add(k); out.push(l); if (out.length >= max) break; }
  return out;
}

// Build a safe parlay (short-priced favourites) and a high-return ACCA. The
// ACCA always populates when ≥2 legs exist: it takes the longest-priced legs
// that still carry a real chance, relaxing the floor until it has enough.
export function buildParlays(legs) {
  const withDec = legs.map(l => ({ ...l, dec: dec(l.am) })).filter(l => l.dec);
  const safe = distinct(withDec.filter(l => l.dec <= SAFE_MAX).sort((a, b) => b.prob - a.prob), 4);
  let acca = [];
  for (const floor of [0.40, 0.30, 0.20, 0]) {  // longest odds that still clear the chance-floor
    acca = distinct(withDec.filter(l => l.prob >= floor).sort((a, b) => b.dec - a.dec), 3);
    if (acca.length >= 2) break;
  }
  return {
    safe: safe.length >= 2 ? combine(safe) : null,
    value: acca.length >= 2 ? combine(acca) : null,
  };
}

// Recommended £ stake, tiered by model confidence (£100 bankroll).
export function stakeGBP(prob) {
  if (prob >= 0.72) return 50;
  if (prob >= 0.62) return 30;
  if (prob >= 0.52) return 20;
  return 10;
}

// Top single "hits" to recommend, ranked by confidence, with a £ stake and the
// example return (stake × decimal odds, total payout incl. stake).
export function recommendedHits(legs, n = 4) {
  return [...legs]
    .filter(l => l.prob >= 0.58 && l.dec >= 1.2)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, n)
    .map(l => {
      const stake = stakeGBP(l.prob);
      return { ...l, stake, ret: Math.round(stake * l.dec) };
    });
}

/* ── Head-to-head (Tennis / Basketball) ── */
// Returns { fav, dog, pA, pB, amA, amB, legs[] } for a match against a roster.
export function h2hMarket(cfg, m) {
  const A = cfg.roster[m.a] || {}, B = cfg.roster[m.b] || {};
  const pA = clamp(winProb(A.r ?? 1500, B.r ?? 1500, cfg.spread), 0.03, 0.97);
  const pB = 1 - pA;
  const amA = probToAm(pA), amB = probToAm(pB);
  const fav = pA >= pB ? { name: m.a, p: pA, am: amA } : { name: m.b, p: pB, am: amB };
  const dog = pA >= pB ? { name: m.b, p: pB, am: amB } : { name: m.a, p: pA, am: amA };

  const legs = [
    { p: `${fav.name} to win`, prob: fav.p, am: fav.am, dec: dec(fav.am), tag: m.label || cfg.label, kind: 'win' },
    { p: `${dog.name} to win`, prob: dog.p, am: dog.am, dec: dec(dog.am), tag: m.label || cfg.label, kind: 'win' },
  ];
  // Totals / spread (basketball)
  if (m.total) {
    const over = (m.totalProb ?? 0.5) >= 0.5;
    legs.push({ p: `${over ? 'Over' : 'Under'} ${m.total} pts`, prob: Math.max(m.totalProb ?? 0.5, 1 - (m.totalProb ?? 0.5)), am: m.totalAm || (over ? '-110' : '-110'), dec: dec(m.totalAm || '-110'), tag: `${m.a} v ${m.b}`, kind: 'total' });
  }
  // Curated player props (robust last-10 hits)
  for (const who of [m.a, m.b]) {
    for (const pr of (cfg.roster[who]?.props || [])) {
      legs.push({
        p: `${pr.player ? pr.player + ' ' : who + ' '}${pr.line} ${pr.m}`,
        prob: clamp((pr.last10 ?? 6) / 10, 0.05, 0.95), am: pr.am, dec: dec(pr.am),
        last10: pr.last10, tag: `${m.a} v ${m.b}`, kind: 'prop',
      });
    }
  }
  return { A, B, pA, pB, amA, amB, fav, dog, legs };
}

/* ── Race (Formula 1) ── */
// Softmax over driver strength for win, gentler softmax (×3 slots) for podium.
export function raceMarket(cfg, ev) {
  const field = ev.field.map(n => ({ name: n, r: cfg.drivers[n]?.r ?? 50, team: cfg.drivers[n]?.team }));
  const sm = (tau) => { const ex = field.map(d => Math.exp(d.r / tau)); const s = ex.reduce((a, b) => a + b, 0); return ex.map(e => e / s); };
  const win = sm(cfg.tauWin ?? 7);
  const podRaw = sm(cfg.tauPod ?? 13);
  const rows = field.map((d, i) => ({
    ...d, pWin: clamp(win[i], 0.01, 0.97), pPodium: clamp(podRaw[i] * 3, 0.02, 0.97),
    amWin: probToAm(clamp(win[i], 0.01, 0.97)), amPodium: probToAm(clamp(podRaw[i] * 3, 0.02, 0.97)),
  })).sort((a, b) => b.pWin - a.pWin);

  // tag = driver, so a parlay/ACCA can stack different drivers but never two
  // correlated legs on the same driver (win + podium).
  const legs = [];
  rows.forEach((d, i) => {
    legs.push({ p: `${d.name} to win`, prob: d.pWin, am: d.amWin, dec: dec(d.amWin), tag: d.name, kind: 'win' });
    legs.push({ p: `${d.name} podium`, prob: d.pPodium, am: d.amPodium, dec: dec(d.amPodium), tag: d.name, kind: 'podium' });
    for (const pr of (cfg.drivers[d.name]?.props || [])) {
      legs.push({ p: `${d.name} ${pr.line} ${pr.m}`, prob: clamp((pr.last10 ?? 7) / 10, 0.05, 0.97), am: pr.am, dec: dec(pr.am), last10: pr.last10, tag: d.name, kind: 'prop' });
    }
  });
  return { rows, legs };
}
