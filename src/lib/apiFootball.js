// API-Football integration (live foul props), via the read-only Cloudflare
// proxy that holds the key. All calls fail safe to null so the UI falls back to
// curated props. Results are cached (memory + localStorage) to respect the free
// tier; the proxy also edge-caches 6h.
import { STATS_PROXY, SEASON } from '../config.js';

export const liveEnabled = () => !!STATS_PROXY;

const mem = {};
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

async function afGet(path) {
  if (!STATS_PROXY) return null;
  const r = await fetch(STATS_PROXY + '/af/' + path);
  if (!r.ok) throw new Error('af ' + r.status);
  return (await r.json()).response;
}

async function teamId(name) {
  const k = 'af_t_' + name;
  if (k in mem) return mem[k];
  const cached = lsGet(k); if (cached !== null) { mem[k] = cached; return cached; }
  const res = await afGet('teams?search=' + encodeURIComponent(name));
  const id = (res && res[0] && res[0].team && res[0].team.id) || null;
  mem[k] = id; lsSet(k, id); return id;
}

// Player season stats for a team incl. fouls committed/drawn. Pages through the
// squad (free tier returns 20/page).
async function squad(name) {
  const id = await teamId(name); if (!id) return null;
  const k = 'af_s_' + id + '_' + SEASON;
  if (k in mem) return mem[k];
  const cached = lsGet(k); if (cached) { mem[k] = cached; return cached; }
  const players = [];
  for (let page = 1; page <= 3; page++) {
    let res;
    try { res = await afGet(`players?team=${id}&season=${SEASON}&page=${page}`); }
    catch { break; }
    if (!res || !res.length) break;
    for (const p of res) {
      const s = (p.statistics && p.statistics[0]) || {};
      players.push({
        name: p.player.name,
        pos: (s.games && s.games.position) || '',
        ap: (s.games && s.games.appearences) || 0,
        starts: (s.games && s.games.lineups) || 0,
        fouls: (s.fouls && s.fouls.committed) || 0,
        drawn: (s.fouls && s.fouls.drawn) || 0,
        shots: (s.shots && s.shots.total) || 0,
        sot: (s.shots && s.shots.on) || 0,
      });
    }
    if (res.length < 20) break;
  }
  const out = players.filter(p => p.ap >= 3);
  mem[k] = out; lsSet(k, out); return out;
}

// P(1+ foul) from a per-appearance rate, via Poisson (1 - e^-rate), capped.
function confFromRate(rate) { return Math.min(96, Math.max(20, Math.round((1 - Math.exp(-rate)) * 100))); }

function pickFor(team, pool) {
  const starters = pool.filter(p => p.starts >= 3 && p.starts >= p.ap * 0.5);
  const reg = starters.length ? starters : pool;
  const out = [];
  const committer = reg.slice().sort((a, b) => b.fouls - a.fouls)[0];
  if (committer && committer.fouls > 0) {
    const rate = committer.fouls / Math.max(1, committer.ap);
    out.push({ team, kind: 'commit', name: committer.name, pos: committer.pos, ap: committer.ap, starts: committer.starts, total: committer.fouls, perGame: rate, conf: confFromRate(rate) });
  }
  const drawer = reg.slice().sort((a, b) => b.drawn - a.drawn)[0];
  if (drawer && drawer.drawn > 0 && (!committer || drawer.name !== committer.name)) {
    const rate = drawer.drawn / Math.max(1, drawer.ap);
    out.push({ team, kind: 'drawn', name: drawer.name, pos: drawer.pos, ap: drawer.ap, starts: drawer.starts, total: drawer.drawn, perGame: rate, conf: confFromRate(rate) });
  }
  return out;
}

// Live foul props for a match, or null if unavailable (→ caller shows curated).
export async function liveFoulProps(m) {
  if (!STATS_PROXY || !m || !m.hT || !m.aT) return null;
  try {
    const [h, a] = await Promise.all([squad(m.hT), squad(m.aT)]);
    const props = [];
    if (h && h.length) props.push(...pickFor(m.hT, h));
    if (a && a.length) props.push(...pickFor(m.aT, a));
    return props.length ? props : null;
  } catch { return null; }
}

// Top shooter per side, ranked by shots-on-target (then total shots).
function shooterFor(team, pool) {
  const starters = pool.filter(p => p.starts >= 3 && p.starts >= p.ap * 0.5);
  const reg = starters.length ? starters : pool;
  const s = reg.slice().sort((a, b) => (b.sot - a.sot) || (b.shots - a.shots))[0];
  if (!s || (s.shots <= 0 && s.sot <= 0)) return null;
  const ap = Math.max(1, s.ap);
  const shotRate = s.shots / ap, sotRate = s.sot / ap;
  return {
    team, name: s.name, pos: s.pos, ap: s.ap, starts: s.starts,
    shots: s.shots, sot: s.sot, shotPerGame: shotRate, sotPerGame: sotRate,
    shotConf: confFromRate(shotRate), sotConf: confFromRate(sotRate),
  };
}

// Live shot props (1+ SOT) for a match, or null if unavailable.
export async function liveShotProps(m) {
  if (!STATS_PROXY || !m || !m.hT || !m.aT) return null;
  try {
    const [h, a] = await Promise.all([squad(m.hT), squad(m.aT)]);
    const props = [];
    if (h && h.length) { const x = shooterFor(m.hT, h); if (x) props.push(x); }
    if (a && a.length) { const x = shooterFor(m.aT, a); if (x) props.push(x); }
    return props.length ? props : null;
  } catch { return null; }
}
