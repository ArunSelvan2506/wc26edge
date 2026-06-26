/* ───────────────────────────────────────────────────────────────────────────
   WC26 EDGE · Prediction model (single source of truth)
   ───────────────────────────────────────────────────────────────────────────
   Opponent-adjusted Poisson ("attack/defense strength") ratings fit from the
   tournament results, regularised toward a historical baseline so the 2-3 game
   sample doesn't overfit, plus the Dixon-Coles low-score correction. Produces
   match-outcome markets (1X2, Over/Under 2.5, BTTS) and value/Kelly numbers.

   This file is the ONE place the math lives. It is:
     • required by scripts/backtest-model.mjs  (calibration)
     • injected verbatim into index.html        (runtime) by build-model.cjs
   so the page and the backtest can never drift.

   IMPORTANT: this is a model over openfootball seed/historical data, not a
   guarantee. Football is high-variance; treat outputs as calibrated estimates.
   ─────────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  // ── Team-name normalisation (match-card hT/aT ↔ standings table names) ──
  const ALIAS = {
    'cabo verde': 'cape verde', 'capeverde': 'cape verde',
    'usa': 'usa', 'united states': 'usa', 'united states of america': 'usa',
    'south korea': 'south korea', 'korea republic': 'south korea',
    'bosnia herzegovina': 'bosnia herzegovina', 'bosnia and herzegovina': 'bosnia herzegovina',
    'ivory coast': 'ivory coast', "cote d ivoire": 'ivory coast',
    'czechia': 'czech republic',
  };
  function norm(name) {
    let s = String(name || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents
      .replace(/[^a-z0-9]+/g, ' ').replace(/\b(and|the)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return ALIAS[s] || s;
  }

  // ── Fit opponent-adjusted attack/defense strengths ──
  // results: [{t1,t2,s1,s2}]  (t1 nominal "home"/first, t2 second)
  // opts.priorGoals: league goals-per-team-per-game prior (historical baseline)
  // opts.k: shrinkage strength (games needed to half-trust the data)
  // opts.hfa: home-field multiplier (1.0 = neutral, correct for a World Cup)
  function fitRatings(results, opts) {
    opts = opts || {};
    const k = opts.k != null ? opts.k : 2.5;
    const hfa = opts.hfa != null ? opts.hfa : 1.0;
    const priorGPG = opts.priorGoals != null ? opts.priorGoals : 1.30; // per team per game

    const teams = new Set();
    let totGoals = 0, totTeamGames = 0;
    for (const r of results) {
      teams.add(norm(r.t1)); teams.add(norm(r.t2));
      totGoals += r.s1 + r.s2; totTeamGames += 2;
    }
    // league average goals per team per game, blended with the prior
    const league = totTeamGames ? (totGoals + priorGPG * 4) / (totTeamGames + 4) : priorGPG;

    // per-team raw aggregates
    const agg = {};
    for (const t of teams) agg[t] = { gf: 0, ga: 0, g: 0 };
    for (const r of results) {
      const a = norm(r.t1), b = norm(r.t2);
      agg[a].gf += r.s1; agg[a].ga += r.s2; agg[a].g++;
      agg[b].gf += r.s2; agg[b].ga += r.s1; agg[b].g++;
    }

    // iterative opponent-adjusted update (Dixon-Coles style, no time weighting)
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
        // Bayesian shrinkage: with few games, regress the ratio toward 1.0
        const g = agg[t].g;
        const rawAtk = scoredExp > 0 ? agg[t].gf / scoredExp : 1;
        const rawDef = concededExp > 0 ? agg[t].ga / concededExp : 1;
        const w = g / (g + k);
        nAtk[t] = Math.exp(w * Math.log(rawAtk || 1));   // shrink in log-space toward 1
        nDef[t] = Math.exp(w * Math.log(rawDef || 1));
      }
      // normalise so the mean attack & mean defense are 1 (identifiability)
      const mA = mean(Object.values(nAtk)), mD = mean(Object.values(nDef));
      for (const t of teams) { atk[t] = nAtk[t] / mA; def[t] = nDef[t] / mD; }
    }
    return { league, hfa, atk, def, teams: [...teams],
             rho: opts.rho != null ? opts.rho : -0.06,
             maxGoals: opts.maxGoals != null ? opts.maxGoals : 10,
             has(name) { return this.atk[norm(name)] != null; } };
  }

  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 1; }

  // ── Expected goals for a fixture ──
  function expected(rat, home, away) {
    const h = norm(home), a = norm(away);
    const ah = rat.atk[h] != null ? rat.atk[h] : 1, dh = rat.def[h] != null ? rat.def[h] : 1;
    const aa = rat.atk[a] != null ? rat.atk[a] : 1, da = rat.def[a] != null ? rat.def[a] : 1;
    return { lh: rat.league * ah * da * rat.hfa, la: rat.league * aa * dh / rat.hfa };
  }

  function pois(lam, k) { return Math.exp(-lam) * Math.pow(lam, k) / fact(k); }
  const _f = [1]; function fact(n) { for (let i = _f.length; i <= n; i++) _f[i] = _f[i - 1] * i; return _f[n]; }

  // Dixon-Coles low-score dependence correction
  function tau(i, j, lh, la, rho) {
    if (i === 0 && j === 0) return 1 - lh * la * rho;
    if (i === 0 && j === 1) return 1 + lh * rho;
    if (i === 1 && j === 0) return 1 + la * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  }

  // ── Scoreline matrix → market probabilities ──
  function markets(rat, home, away) {
    const { lh, la } = expected(rat, home, away);
    const N = rat.maxGoals, rho = rat.rho;
    let pHome = 0, pDraw = 0, pAway = 0, pOver = 0, pBtts = 0, Z = 0;
    const m = [];
    for (let i = 0; i <= N; i++) {
      m[i] = [];
      for (let j = 0; j <= N; j++) {
        const p = pois(lh, i) * pois(la, j) * tau(i, j, lh, la, rho);
        m[i][j] = p; Z += p;
      }
    }
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const p = m[i][j] / Z;
      if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
      if (i + j >= 3) pOver += p;
      if (i >= 1 && j >= 1) pBtts += p;
    }
    return { lh, la, home: pHome, draw: pDraw, away: pAway,
             over25: pOver, under25: 1 - pOver, btts: pBtts, noBtts: 1 - pBtts };
  }

  // ── Odds / value helpers ──
  function amToDec(am) {
    const n = parseFloat(String(am).replace(/[^\-+0-9.]/g, ''));
    if (!isFinite(n) || n === 0) return null;
    return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  }
  // remove the bookmaker margin from a set of implied probabilities → fair probs
  function devig(decimals) {
    const imp = decimals.map(d => (d ? 1 / d : 0));
    const s = imp.reduce((a, b) => a + b, 0);
    return s > 0 ? imp.map(x => x / s) : imp;
  }
  // expected value per 1 unit staked at decimal odds, given true win prob
  function ev(prob, dec) { return dec ? prob * (dec - 1) - (1 - prob) : null; }
  // full-Kelly fraction of bankroll (clamped to [0,1]); caller may scale (e.g. ×0.25)
  function kelly(prob, dec) {
    if (!dec || dec <= 1) return 0;
    const b = dec - 1, q = 1 - prob;
    const f = (b * prob - q) / b;
    return f > 0 ? Math.min(f, 1) : 0;
  }

  const M = { norm, fitRatings, expected, markets, amToDec, devig, ev, kelly, pois, tau };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.WCModel = M;
})(typeof globalThis !== 'undefined' ? globalThis : this);
