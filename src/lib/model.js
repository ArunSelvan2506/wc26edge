// WC26 EDGE · prediction model (ESM) — opponent-adjusted Poisson / Dixon-Coles.
// Logic kept identical to scripts/wc-model.cjs (the backtest's source of truth).

const ALIAS = {
  'cabo verde': 'cape verde', 'capeverde': 'cape verde',
  'usa': 'usa', 'united states': 'usa', 'united states of america': 'usa',
  'south korea': 'south korea', 'korea republic': 'south korea',
  'bosnia herzegovina': 'bosnia herzegovina', 'bosnia and herzegovina': 'bosnia herzegovina',
  'ivory coast': 'ivory coast', 'cote d ivoire': 'ivory coast',
  'czechia': 'czech republic',
};

export function norm(name) {
  let s = String(name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\b(and|the)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return ALIAS[s] || s;
}

function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 1; }

export function fitRatings(results, opts = {}) {
  const k = opts.k != null ? opts.k : 2.5;
  const hfa = opts.hfa != null ? opts.hfa : 1.0;
  const priorGPG = opts.priorGoals != null ? opts.priorGoals : 1.30;

  const teams = new Set();
  let totGoals = 0, totTeamGames = 0;
  for (const r of results) {
    teams.add(norm(r.t1)); teams.add(norm(r.t2));
    totGoals += r.s1 + r.s2; totTeamGames += 2;
  }
  const league = totTeamGames ? (totGoals + priorGPG * 4) / (totTeamGames + 4) : priorGPG;

  const agg = {};
  for (const t of teams) agg[t] = { gf: 0, ga: 0, g: 0 };
  for (const r of results) {
    const a = norm(r.t1), b = norm(r.t2);
    agg[a].gf += r.s1; agg[a].ga += r.s2; agg[a].g++;
    agg[b].gf += r.s2; agg[b].ga += r.s1; agg[b].g++;
  }

  const atk = {}, def = {};
  for (const t of teams) { atk[t] = 1; def[t] = 1; }
  for (let iter = 0; iter < 60; iter++) {
    const nAtk = {}, nDef = {};
    for (const t of teams) {
      let scoredExp = 0, concededExp = 0;
      for (const r of results) {
        const a = norm(r.t1), b = norm(r.t2);
        if (a === t) { scoredExp += league * def[b] * hfa; concededExp += league * atk[b] * hfa; }
        else if (b === t) { scoredExp += league * def[a]; concededExp += league * atk[a]; }
      }
      const g = agg[t].g;
      const rawAtk = scoredExp > 0 ? agg[t].gf / scoredExp : 1;
      const rawDef = concededExp > 0 ? agg[t].ga / concededExp : 1;
      const w = g / (g + k);
      nAtk[t] = Math.exp(w * Math.log(rawAtk || 1));
      nDef[t] = Math.exp(w * Math.log(rawDef || 1));
    }
    const mA = mean(Object.values(nAtk)), mD = mean(Object.values(nDef));
    for (const t of teams) { atk[t] = nAtk[t] / mA; def[t] = nDef[t] / mD; }
  }
  return {
    league, hfa, atk, def, teams: [...teams],
    rho: opts.rho != null ? opts.rho : -0.06,
    maxGoals: opts.maxGoals != null ? opts.maxGoals : 10,
    has(name) { return this.atk[norm(name)] != null; },
  };
}

export function expected(rat, home, away) {
  const h = norm(home), a = norm(away);
  const ah = rat.atk[h] ?? 1, dh = rat.def[h] ?? 1;
  const aa = rat.atk[a] ?? 1, da = rat.def[a] ?? 1;
  return { lh: rat.league * ah * da * rat.hfa, la: rat.league * aa * dh / rat.hfa };
}

const _f = [1];
function fact(n) { for (let i = _f.length; i <= n; i++) _f[i] = _f[i - 1] * i; return _f[n]; }
export function pois(lam, k) { return Math.exp(-lam) * Math.pow(lam, k) / fact(k); }

export function tau(i, j, lh, la, rho) {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

export function markets(rat, home, away) {
  const { lh, la } = expected(rat, home, away);
  const N = rat.maxGoals, rho = rat.rho;
  let pHome = 0, pDraw = 0, pAway = 0, pOver = 0, pBtts = 0, Z = 0;
  const m = [];
  for (let i = 0; i <= N; i++) {
    m[i] = [];
    for (let j = 0; j <= N; j++) { const p = pois(lh, i) * pois(la, j) * tau(i, j, lh, la, rho); m[i][j] = p; Z += p; }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = m[i][j] / Z;
    if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
    if (i + j >= 3) pOver += p;
    if (i >= 1 && j >= 1) pBtts += p;
  }
  return { lh, la, home: pHome, draw: pDraw, away: pAway, over25: pOver, under25: 1 - pOver, btts: pBtts, noBtts: 1 - pBtts };
}

export function amToDec(am) {
  const n = parseFloat(String(am).replace(/[^\-+0-9.]/g, ''));
  if (!isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
export function devig(decimals) {
  const imp = decimals.map(d => (d ? 1 / d : 0));
  const s = imp.reduce((a, b) => a + b, 0);
  return s > 0 ? imp.map(x => x / s) : imp;
}
export function ev(prob, dec) { return dec ? prob * (dec - 1) - (1 - prob) : null; }
export function kelly(prob, dec) {
  if (!dec || dec <= 1) return 0;
  const b = dec - 1, q = 1 - prob;
  const f = (b * prob - q) / b;
  return f > 0 ? Math.min(f, 1) : 0;
}

// Fit ratings once from the standings results object (WC_TABLE).
export function fitFromTable(wcTable) {
  let res = [];
  for (const g in wcTable) res = res.concat(wcTable[g].results || []);
  return res.length ? fitRatings(res, { priorGoals: 1.30 }) : null;
}
