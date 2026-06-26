// Parlay logic — safe slip (highest-confidence legs) + distinct value slip.
// Candidate legs come from the curated easy bets PLUS model-derived markets
// (Double Chance and Both Teams To Score), so the engine can build those in.
import { amToDec, amToProb } from './odds.js';
import { markets } from './model.js';

const nk = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const same = (a, b) => { if (!a || !b) return false; if (a === b) return true; const sh = a.length <= b.length ? a : b, lo = a.length <= b.length ? b : a; return sh.length >= 6 && lo.includes(sh); };

// Fair-ish American odds from a model probability, with a small (~5%) book
// margin so synthesized legs pay out like the curated ones. Implied is clamped
// so we never display silly numbers like -3000 on a near-certain pick.
function probToAm(prob) {
  const implied = Math.min(0.88, Math.max(0.04, prob) * 1.05);
  const dec = 1 / implied;
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) + ' est.' : '-' + Math.round(100 / (dec - 1)) + ' est.';
}

// Model-derived markets as easy-bet-shaped legs: Double Chance + BTTS.
export function marketLegs(m, rat) {
  if (!rat || !m || !m.hT || !m.aT) return [];
  const mk = markets(rat, m.hT, m.aT);
  const legs = [];
  // Double chance — strongest of 1X / X2 / 12. Skip near-locks (>86%, where the
  // straight win is the play) and toss-ups (<58%, not meaningfully "safe").
  const dc = [
    { p: `${m.hT} or draw`, prob: mk.home + mk.draw },
    { p: `${m.aT} or draw`, prob: mk.away + mk.draw },
    { p: `${m.hT} or ${m.aT} (no draw)`, prob: mk.home + mk.away },
  ].sort((a, b) => b.prob - a.prob)[0];
  if (dc.prob >= 0.58 && dc.prob <= 0.86) {
    legs.push({ c: 'Double chance', p: `${dc.p} (DC)`, o: probToAm(dc.prob), cf: Math.round(dc.prob * 100), model: true });
  }
  // Both teams to score.
  legs.push({ c: 'BTTS', p: 'Both teams to score', o: probToAm(mk.btts), cf: Math.round(mk.btts * 100), model: true });
  return legs;
}

// Curated easy bets + model legs (model legs dropped if they duplicate a
// curated pick, e.g. a hand-set "Both teams score").
export function candidatePool(m, rat) {
  const base = (m.easy || []).filter(e => e.cf != null && amToDec(e.o) != null);
  const haveKeys = base.map(e => nk(e.p));
  const extra = marketLegs(m, rat).filter(l => amToDec(l.o) != null && !haveKeys.some(h => same(h, nk(l.p))));
  return [...base, ...extra];
}

export function legProb(m, pick, odds) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const np = norm(pick); if (!np) return amToProb(odds) || 0.5;
  const e = (m.easy || []).find(x => { const n = norm(x.p); return n && (np.includes(n) || n.includes(np)); });
  if (e && e.cf != null) return e.cf / 100;
  const c = (m.cbars || []).find(x => { const n = norm(x.l); return n && (np.includes(n) || n.includes(np)); });
  if (c && c.p != null) return c.p / 100;
  const ip = amToProb(odds); return ip != null ? ip : 0.5;
}

export function parlayMetrics(legs) {
  let prob = 1, dec = 1, ok = true;
  legs.forEach(l => { prob *= l.prob; const d = amToDec(l.o); if (d) dec *= d; else ok = false; });
  return { prob, dec: ok ? dec : null };
}

export function gradeOf(prob) {
  return prob >= 0.55 ? { lbl: 'SAFE', col: 'var(--ac)', bg: 'rgba(45,200,160,.12)', bd: 'rgba(45,200,160,.4)' }
       : prob >= 0.35 ? { lbl: 'BALANCED', col: 'var(--amb)', bg: 'rgba(246,178,63,.12)', bd: 'rgba(246,178,63,.4)' }
       : { lbl: 'RISKY', col: 'var(--red)', bg: 'rgba(239,109,109,.12)', bd: 'rgba(239,109,109,.4)' };
}

// Greedy: take highest-confidence legs, grow while combined hit stays high.
export function safeParlay(pool) {
  const cands = pool.map(e => ({ p: e.p, o: e.o, prob: e.cf / 100 })).sort((a, b) => b.prob - a.prob);
  if (cands.length < 2) return cands;
  let legs = cands.slice(0, 2), prob = legs[0].prob * legs[1].prob;
  for (let i = 2; i < cands.length && legs.length < 4; i++) {
    const np = prob * cands[i].prob; if (np < 0.60) break;
    legs.push(cands[i]); prob = np;
  }
  return legs;
}

// Build both slips; value slip stays DISTINCT from the safe slip, backfilled
// from the longest-odds remaining candidates (curated + model markets).
export function buildParlay(m, rat) {
  const pool = candidatePool(m, rat);
  const safe = safeParlay(pool);
  const safeKeys = (safe || []).map(l => nk(l.p));
  const dupOfSafe = kk => safeKeys.some(sk => same(sk, kk));

  let vlegs = (m.parlay || []).map(p => ({ p: p.p, o: p.o, prob: legProb(m, p.p, p.o), _k: nk(p.p) })).filter(l => !dupOfSafe(l._k));
  if (vlegs.length < 3) {
    const have = vlegs.map(l => l._k);
    pool
      .map(e => ({ p: e.p, o: e.o, prob: e.cf / 100, _k: nk(e.p) }))
      .filter(l => !dupOfSafe(l._k) && !have.some(h => same(h, l._k)))
      .sort((a, b) => amToDec(b.o) - amToDec(a.o))
      .forEach(l => { if (vlegs.length < 3) { vlegs.push(l); have.push(l._k); } });
  }

  const out = {};
  if (safe && safe.length >= 2) { const sm = parlayMetrics(safe); out.safe = { legs: safe, metrics: sm, grade: gradeOf(sm.prob) }; }
  if (vlegs.length >= 2) { const vm = parlayMetrics(vlegs); out.value = { legs: vlegs, metrics: vm, grade: gradeOf(vm.prob) }; }
  return out;
}
