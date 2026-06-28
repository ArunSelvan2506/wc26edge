// Tennis model — Elo win probability with surface, recent-form and injury
// adjustments, plus model-derived sets / total-games / aces markets. It works
// off ratings alone, so it applies to ANY matchup and covers every upcoming
// fixture automatically. Fair odds (no bookmaker margin).
import { probToAm, dec } from './sportEngine.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const logistic = (d, s) => 1 / (1 + Math.exp(-d / s));
const line5 = x => Math.floor(x) + 0.5;
function ncdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const pOver = (line, mean, sd) => clamp(1 - ncdf((line - mean) / sd), 0.05, 0.95);
const poisOver = (line, mean) => { const k = Math.floor(line); let c = 0, t = Math.exp(-mean); for (let i = 0; i <= k; i++) { c += t; t *= mean / (i + 1); } return clamp(1 - c, 0.05, 0.95); };

// Recent form W/L list → net rate in [-1, 1].
export function formScore(form) {
  if (!form || !form.length) return 0;
  let s = 0; for (const r of form) s += /w/i.test(r) ? 1 : /l/i.test(r) ? -1 : 0;
  return s / form.length;
}
// Injury text → { pen (Elo points), risk } for model + UI weighting.
export function injInfo(inj) {
  if (!inj) return { pen: 0, risk: 'none' };
  const s = String(inj).toLowerCase();
  if (/\bout\b|withdraw|retir|will not|ruled out/.test(s)) return { pen: 500, risk: 'out' };
  if (/doubt|questionable|game-time|50\/50|uncertain/.test(s)) return { pen: 110, risk: 'high' };
  if (/minor|probable|fit|niggle|knock|manag/.test(s)) return { pen: 35, risk: 'low' };
  return { pen: 60, risk: 'med' };
}

// Surface-, form- and injury-adjusted Elo for a player.
export function effRating(p, surface) {
  const surf = (p && p.surf && surface && p.surf[surface]) || 0;
  return (p?.r ?? 1500) + surf + formScore(p?.form) * 30 - injInfo(p?.inj).pen;
}

// Solve set-win prob s from match-win prob P for a best-of-N match.
function setProb(P, bestOf) {
  const need = bestOf === 5 ? 3 : 2;
  const matchP = s => {            // P(win `need` sets before opponent does)
    let tot = 0;
    for (let l = 0; l < need; l++) {       // opponent wins l sets
      let c = 1; for (let i = 0; i < need - 1 + l; i++) c = c * (need + l - 1 - i) / (i + 1); // C(need-1+l, l)
      tot += c * Math.pow(s, need) * Math.pow(1 - s, l);
    }
    return tot;
  };
  let lo = 0.5, hi = 0.999;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (matchP(mid) < P) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// One match → win probs, derived markets, status, and tagged legs (each leg
// carries form/injury metadata so selection can be in-form & injury-aware).
export function tennisMatch(cfg, m, now = 0) {
  const A = cfg.roster[m.a] || {}, B = cfg.roster[m.b] || {};
  const surface = m.surface || cfg.surface || 'hard';
  const bestOf = m.bestOf || (/atp/i.test(m.label || '') && /slam|wimbledon|open|roland|us open/i.test(m.series || cfg.label || '') ? 5 : 3);
  const rA = effRating(A, surface), rB = effRating(B, surface);
  const pA = clamp(logistic(rA - rB, cfg.spread || 190), 0.03, 0.97), pB = 1 - pA;
  const amA = probToAm(pA), amB = probToAm(pB);
  const aSide = { name: m.a, p: pA, am: amA, inj: A.inj, form: A.form, fs: formScore(A.form) };
  const bSide = { name: m.b, p: pB, am: amB, inj: B.inj, form: B.form, fs: formScore(B.form) };
  const fav = pA >= pB ? aSide : bSide, dog = pA >= pB ? bSide : aSide;

  const s = setProb(fav.p, bestOf);              // favourite's per-set win prob
  const straight = bestOf === 5 ? s * s * s : s * s;          // fav wins without dropping a set
  const dogSet = 1 - straight;                                // underdog wins ≥1 set
  const close = 1 - Math.abs(pA - pB);                        // 0 blowout … 1 even
  const expGames = (bestOf === 5 ? 30 : 19.5) + close * (bestOf === 5 ? 11 : 7);
  const gLine = line5(expGames), gOver = pOver(gLine, expGames, bestOf === 5 ? 5 : 3.4);
  const overSide = gOver >= 0.5;

  const tag = `${m.a.split(' ').slice(-1)[0]} v ${m.b.split(' ').slice(-1)[0]}`;
  const legs = [
    { p: `${fav.name} to win`, prob: fav.p, am: fav.am, dec: dec(fav.am), tag, kind: 'win', player: fav.name, fs: fav.fs, inj: fav.inj, why: rationale(fav, dog, surface) },
    { p: `${dog.name} to win`, prob: dog.p, am: dog.am, dec: dec(dog.am), tag, kind: 'win', player: dog.name, fs: dog.fs, inj: dog.inj, why: `Live dog — ${pcs(dog.p)} model edge` },
    { p: `${fav.name} ${bestOf === 5 ? '3-0' : '2-0'} (straight sets)`, prob: straight, am: probToAm(straight), dec: dec(probToAm(straight)), tag, kind: 'sets', player: fav.name, fs: fav.fs, inj: fav.inj, why: `${pcs(s)} per-set edge` },
    { p: `${dog.name} to win a set`, prob: dogSet, am: probToAm(dogSet), dec: dec(probToAm(dogSet)), tag, kind: 'sets', player: dog.name, fs: dog.fs, inj: dog.inj, why: 'value / insurance leg' },
    { p: `${overSide ? 'Over' : 'Under'} ${gLine} total games`, prob: overSide ? gOver : 1 - gOver, am: probToAm(overSide ? gOver : 1 - gOver), dec: dec(probToAm(overSide ? gOver : 1 - gOver)), tag, kind: 'games', why: close > 0.6 ? 'tight match-up → long' : 'mismatch → short' },
  ];
  // Aces props (server tendency) for each player.
  for (const side of [aSide, bSide]) {
    const av = (cfg.roster[side.name] || {}).aces;
    if (av) {
      const ln = Math.max(2.5, line5(av - 1));
      const pr = poisOver(ln, av);
      legs.push({ p: `${side.name} Over ${ln} aces`, prob: pr, am: probToAm(pr), dec: dec(probToAm(pr)), tag, kind: 'prop', player: side.name, fs: side.fs, inj: side.inj, last10: Math.round(pr * 10), why: `${av} aces/match avg` });
    }
  }

  return { surface, bestOf, pA, pB, amA, amB, fav, dog, s, straight, dogSet, expGames, gLine, legs, favWhy: rationale(fav, dog, surface), status: matchStatus(m.utc, bestOf, now) };
}

const pcs = p => Math.round(p * 100) + '%';
function rationale(fav, dog, surface) {
  const bits = [];
  if (fav.fs >= 0.4) bits.push('hot form');
  else if (fav.fs <= -0.2) bits.push('patchy form');
  const di = injInfo(dog.inj);
  if (di.risk === 'out' || di.risk === 'high') bits.push(`opp injury (${dog.inj})`);
  else if (di.risk === 'low' || di.risk === 'med') bits.push('opp carrying a knock');
  bits.push(`${surface}-court edge`);
  return bits.join(' · ');
}

// Status from start time. A match is "live" for ~bestOf duration, then "done".
export function matchStatus(utc, bestOf = 3, now = 0) {
  const t = typeof utc === 'number' ? utc : Date.parse(utc);
  if (!isFinite(t) || !now) return { state: 'upcoming', startsIn: t - now };
  const dur = (bestOf === 5 ? 3.6 : 2.2) * 3600e3;
  if (now < t) return { state: 'upcoming', startsIn: t - now };
  if (now < t + dur) return { state: 'live', startsIn: 0 };
  return { state: 'done', startsIn: 0 };
}

// In-form & injury-aware ranking score for a leg.
function legScore(l) {
  const i = injInfo(l.inj);
  let pen = 0;
  if (l.kind === 'win' || l.kind === 'sets' || l.kind === 'prop') {
    if (i.risk === 'out') pen += 0.6;          // backing a hurt player to perform — avoid
    else if (i.risk === 'high') pen += 0.25;
    else if (i.risk === 'med') pen += 0.1;
  }
  const formBoost = (l.fs || 0) * 0.08;          // reward in-form pick
  return l.prob + formBoost - pen;
}

// Recommended single "hits" — in-form, fit, odds-on, ranked, with £ stakes.
export function tennisHits(legs, n = 5) {
  const stake = p => p >= 0.72 ? 50 : p >= 0.62 ? 30 : p >= 0.52 ? 20 : 10;
  return legs
    .filter(l => l.dec && l.prob >= 0.55 && injInfo(l.inj).risk !== 'out')
    .map(l => ({ l, sc: legScore(l) }))
    .sort((x, y) => y.sc - x.sc)
    .slice(0, n)
    .map(({ l }) => ({ ...l, stake: stake(l.prob), ret: Math.round(stake(l.prob) * l.dec) }));
}

// Safe (≤1.75) & value (≥4.0) parlays, in-form weighted, skipping hurt players.
export function tennisParlays(legs) {
  const ok = legs.filter(l => l.dec && injInfo(l.inj).risk !== 'out' && injInfo(l.inj).risk !== 'high');
  const pick = (filterFn, k) => {
    const set = ok.filter(filterFn).map(l => ({ l, sc: legScore(l) })).sort((a, b) => b.sc - a.sc);
    const seen = new Set(), out = [];
    for (const { l } of set) { if (seen.has(l.tag)) continue; seen.add(l.tag); out.push(l); if (out.length >= k) break; }
    return out;
  };
  const combine = ls => ls.length >= 2 ? { legs: ls, prob: ls.reduce((a, l) => a * l.prob, 1), dec: ls.reduce((a, l) => a * l.dec, 1) } : null;
  return {
    safe: combine(pick(l => l.dec <= 1.75, 4)),
    value: combine(pick(l => l.dec >= 4.0, 3)),
  };
}
