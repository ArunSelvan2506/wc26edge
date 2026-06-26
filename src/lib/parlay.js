// Parlay logic — safe slip (highest-confidence legs) + distinct value slip.
// Ported from index.html buildParlay; returns data, components render it.
import { amToDec, amToProb } from './odds.js';

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
export function safeParlay(m) {
  const pool = (m.easy || []).filter(e => e.cf != null && amToDec(e.o) != null)
    .map(e => ({ p: e.p, o: e.o, prob: e.cf / 100 })).sort((a, b) => b.prob - a.prob);
  if (pool.length < 2) return pool;
  let legs = pool.slice(0, 2), prob = legs[0].prob * legs[1].prob;
  for (let i = 2; i < pool.length && legs.length < 4; i++) {
    const np = prob * pool[i].prob; if (np < 0.60) break;
    legs.push(pool[i]); prob = np;
  }
  return legs;
}

// Build both slips; value slip stays DISTINCT from the safe slip (dedup by
// parenthetical-stripped containment), backfilled from longest-odds easy bets.
export function buildParlay(m) {
  const safe = safeParlay(m);
  const _nk = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const _same = (a, b) => { if (!a || !b) return false; if (a === b) return true; const sh = a.length <= b.length ? a : b, lo = a.length <= b.length ? b : a; return sh.length >= 6 && lo.includes(sh); };
  const safeKeys = (safe || []).map(l => _nk(l.p));
  const dupOfSafe = kk => safeKeys.some(sk => _same(sk, kk));

  let vlegs = (m.parlay || []).map(p => ({ p: p.p, o: p.o, prob: legProb(m, p.p, p.o), _k: _nk(p.p) })).filter(l => !dupOfSafe(l._k));
  if (vlegs.length < 2) {
    const have = vlegs.map(l => l._k);
    (m.easy || []).filter(e => e.cf != null && amToDec(e.o) != null)
      .map(e => ({ p: e.p, o: e.o, prob: e.cf / 100, _k: _nk(e.p) }))
      .filter(l => !dupOfSafe(l._k) && !have.some(h => _same(h, l._k)))
      .sort((a, b) => amToDec(b.o) - amToDec(a.o))
      .forEach(l => { if (vlegs.length < 3) { vlegs.push(l); have.push(l._k); } });
  }

  const out = {};
  if (safe && safe.length >= 2) { const sm = parlayMetrics(safe); out.safe = { legs: safe, metrics: sm, grade: gradeOf(sm.prob) }; }
  if (vlegs.length >= 2) { const vm = parlayMetrics(vlegs); out.value = { legs: vlegs, metrics: vm, grade: gradeOf(vm.prob) }; }
  return out;
}
