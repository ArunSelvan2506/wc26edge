// Live data refresh (no API key). Pulls the openfootball World Cup 2026 feed
// and regenerates from it:
//   • WC_TABLE        — group standings + completed results (model refits from these)
//   • FIXTURES (KO)   — the knockout bracket, which the feed RESOLVES as group
//                       results come in (so Round of 32 etc. auto-update with the
//                       real teams). Each KO match carries an exact kickoff
//                       timestamp (koUTC) for robust completion.
// Curated group-stage cards (DAYS) and baselines (OG_STATS) are left untouched.
//
// Usage: node scripts/refresh-data.mjs   (npm run refresh)
import { readFileSync, writeFileSync } from 'fs';
import { norm } from '../src/lib/model.js';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const STAGE = {
  'Round of 32': 'Round of 32', 'Round of 16': 'Round of 16',
  'Quarter-final': 'Quarter-Finals', 'Semi-final': 'Semi-Finals',
  'Match for third place': 'Third Place Play-off', 'Final': '🏆 World Cup Final',
};

// Feed time "12:00 UTC-7" + date "2026-06-28" → kickoff in UTC ms.
function feedKickoffUTC(dateStr, timeStr) {
  const t = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/);
  const d = String(dateStr || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!t || !d) return null;
  return Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - parseInt(t[3], 10) * 3600000;
}
function istParts(koMs) { const d = new Date(koMs + IST_OFFSET_MS); return { wd: WD[d.getUTCDay()], day: d.getUTCDate(), mon: MON[d.getUTCMonth()], h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
function istDateLabel(koMs) { const p = istParts(koMs); return `${p.wd} ${p.day} ${p.mon} (IST)`; }
function istTime(koMs) { const p = istParts(koMs); const ap = p.h < 12 ? 'am' : 'pm'; let h = p.h % 12; if (h === 0) h = 12; return `${h}:${String(p.mi).padStart(2, '0')}${ap}`; }

// Build knockout fixture blocks from the feed (teams resolve as results land).
function buildKnockout(matches) {
  const items = matches
    .filter(m => !m.group && STAGE[m.round])
    .map(m => ({ ko: feedKickoffUTC(m.date, m.time), stage: STAGE[m.round], teams: `${m.team1} vs ${m.team2}`, ground: m.ground || '' }))
    .filter(x => x.ko != null)
    .sort((a, b) => a.ko - b.ko);
  const blocks = [], idx = {};
  for (const it of items) {
    const date = istDateLabel(it.ko), key = date + '|' + it.stage;
    if (!idx[key]) { idx[key] = { date, stage: it.stage, _ko: it.ko, matches: [] }; blocks.push(idx[key]); }
    idx[key].matches.push({ ist: istTime(it.ko), teams: it.teams, grp: it.ground, koUTC: it.ko });
  }
  return blocks.sort((a, b) => a._ko - b._ko).map(({ _ko, ...b }) => b);
}

const SRC = process.env.WC_FEED ||
  'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';
// Only games on/before "today" (UTC) count as completed — keeps standings
// truthful to the real calendar even if the feed is pre-seeded.
const CUTOFF = process.env.WC_CUTOFF || new Date().toISOString().slice(0, 10);
const DATA = new URL('../src/data.json', import.meta.url);

function buildTable(matches) {
  const groups = {}, results = {};
  const ensure = (g, t) => { (groups[g] ??= {})[t] ??= { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; return groups[g][t]; };
  for (const m of matches) {
    if (!m.group) continue;                                  // group stage only
    const g = m.group.replace(/^Group\s*/i, '').trim();
    const ft = m.score && Array.isArray(m.score.ft) ? m.score.ft : null;
    ensure(g, m.team1); ensure(g, m.team2);                  // teams appear even if not yet played
    const played = ft && (!m.date || m.date <= CUTOFF);
    if (!played) continue;
    const [a, b] = ft, A = ensure(g, m.team1), B = ensure(g, m.team2);
    A.p++; B.p++; A.gf += a; A.ga += b; B.gf += b; B.ga += a;
    if (a > b) { A.w++; B.l++; A.pts += 3; }
    else if (a < b) { B.w++; A.l++; B.pts += 3; }
    else { A.d++; B.d++; A.pts++; B.pts++; }
    (results[g] ??= []).push({ date: m.date, t1: m.team1, t2: m.team2, s1: a, s2: b });
  }
  const out = {};
  for (const g of Object.keys(groups).sort()) {
    const table = Object.values(groups[g]).map(t => ({ ...t, gd: t.gf - t.ga }))
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team));
    out[g] = { table, results: (results[g] || []).sort((a, b) => (a.date || '').localeCompare(b.date || '')) };
  }
  return out;
}

/* ── API-Football live foul/shot props (server-side, free-tier safe) ──────────
   Runs only when API_FOOTBALL_KEY is set (a GitHub Actions secret). Player
   squads are cached to data/af-cache.json (persisted across runs via the
   workflow's actions/cache), so each upcoming team's squad is fetched ~once a
   day; most hourly runs make ZERO API calls and just recompute props from cache.
   A hard per-run budget guarantees we never blow the 100/day free tier. The
   browser makes NO API calls — props are baked into src/data.json. */
const AF_KEY = process.env.API_FOOTBALL_KEY || '';
const AF_BASE = 'https://v3.football.api-sports.io';
const AF_BUDGET = Number(process.env.AF_BUDGET || 40);
const SEASON = Number(process.env.AF_SEASON || 2024);   // form proxy; free tier allows 2022–2024 only
const SQUAD_TTL_MS = 20 * 3600 * 1000;
const CACHE = new URL('../data/af-cache.json', import.meta.url);
const MON3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
let afCalls = 0;
let afCache = { teams: {}, squads: {} };
try { afCache = JSON.parse(readFileSync(CACHE, 'utf8')); } catch { /* first run */ }
afCache.teams ||= {}; afCache.squads ||= {};

async function af(path) {
  if (!AF_KEY || afCalls >= AF_BUDGET) return null;
  afCalls++;
  try {
    const r = await fetch(AF_BASE + '/' + path, { headers: { 'x-apisports-key': AF_KEY } });
    const j = await r.json().catch(() => null);
    if (!r.ok) { console.error('  AF HTTP', r.status, path.split('?')[0]); return null; }
    const errs = j && j.errors;
    const hasErr = errs && (Array.isArray(errs) ? errs.length : Object.keys(errs).length);
    if (hasErr) { console.error('  AF errors', path.split('?')[0], JSON.stringify(errs)); return null; }
    return j ? j.response : null;
  } catch (e) { console.error('  AF fetch failed', path.split('?')[0], e.message); return null; }
}
async function teamId(name) {
  if (afCache.teams[name] != null) return afCache.teams[name];
  const res = await af('teams?search=' + encodeURIComponent(name));
  const id = (res && res[0] && res[0].team && res[0].team.id) || null;
  if (id == null) console.error('  no team id for', name, '(results:', (res ? res.length : 'null') + ')');
  if (id != null) afCache.teams[name] = id;
  return id;
}
async function squad(name, now) {
  const id = await teamId(name); if (!id) return null;
  const c = afCache.squads[id];
  if (c && now - c.ts < SQUAD_TTL_MS) return c.players;   // cache hit → no API call
  const players = [];
  for (let page = 1; page <= 2; page++) {
    const res = await af(`players?team=${id}&season=${SEASON}&page=${page}`);
    if (!res || !res.length) break;
    for (const p of res) {
      const s = (p.statistics && p.statistics[0]) || {};
      players.push({
        name: p.player.name, pos: (s.games && s.games.position) || '',
        ap: (s.games && s.games.appearences) || 0, starts: (s.games && s.games.lineups) || 0,
        fouls: (s.fouls && s.fouls.committed) || 0, drawn: (s.fouls && s.fouls.drawn) || 0,
        shots: (s.shots && s.shots.total) || 0, sot: (s.shots && s.shots.on) || 0,
      });
    }
    if (res.length < 20) break;
  }
  const filtered = players.filter(p => p.ap >= 3);
  const withFouls = filtered.filter(p => p.fouls > 0 || p.drawn > 0).length;
  console.error(`  squad ${name} (id ${id}): ${players.length} players, ${filtered.length} with 3+ apps, ${withFouls} with foul data`);
  if (filtered.length) { afCache.squads[id] = { ts: now, players: filtered }; return filtered; }
  return null;
}
const confFromRate = rate => Math.min(96, Math.max(20, Math.round((1 - Math.exp(-rate)) * 100)));
function foulProps(team, pool) {
  const starters = pool.filter(p => p.starts >= 3 && p.starts >= p.ap * 0.5);
  const reg = starters.length ? starters : pool, out = [];
  const c = reg.slice().sort((a, b) => b.fouls - a.fouls)[0];
  if (c && c.fouls > 0) { const r = c.fouls / Math.max(1, c.ap); out.push({ team, kind: 'commit', name: c.name, pos: c.pos, ap: c.ap, starts: c.starts, total: c.fouls, perGame: +r.toFixed(2), conf: confFromRate(r) }); }
  const d = reg.slice().sort((a, b) => b.drawn - a.drawn)[0];
  if (d && d.drawn > 0 && (!c || d.name !== c.name)) { const r = d.drawn / Math.max(1, d.ap); out.push({ team, kind: 'drawn', name: d.name, pos: d.pos, ap: d.ap, starts: d.starts, total: d.drawn, perGame: +r.toFixed(2), conf: confFromRate(r) }); }
  return out;
}
function shotProp(team, pool) {
  const starters = pool.filter(p => p.starts >= 3 && p.starts >= p.ap * 0.5);
  const reg = starters.length ? starters : pool;
  const s = reg.slice().sort((a, b) => (b.sot - a.sot) || (b.shots - a.shots))[0];
  if (!s || (s.shots <= 0 && s.sot <= 0)) return null;
  const ap = Math.max(1, s.ap);
  return { team, name: s.name, pos: s.pos, ap: s.ap, starts: s.starts, shots: s.shots, sot: s.sot, shotConf: confFromRate(s.shots / ap), sotConf: confFromRate(s.sot / ap) };
}
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');
function daysKickoffUTC(dayKey, mt, dates) {
  const de = (dates || []).find(x => x.key === dayKey);
  const dm = de && de.etNote && de.etNote.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  const tm = (mt.time || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*ET/i);
  if (!dm || !tm) return null;
  let h = (+tm[1]) % 12; if (/pm/i.test(tm[3])) h += 12;
  return Date.UTC(2026, MON3[dm[2].toLowerCase()], +dm[1], h + 4, tm[2] ? +tm[2] : 0); // ET=EDT=UTC-4
}
async function buildLive(data, now) {
  if (!AF_KEY) return data.LIVE || {};       // no key → leave whatever's baked
  const out = {};
  const dates = data.DATES || [];
  let upcoming = 0;
  for (const k in (data.DAYS || {})) {
    for (const mt of data.DAYS[k].matches) {
      if (mt.done) continue;
      const ko = daysKickoffUTC(k, mt, dates);
      if (ko != null && now > ko + 135 * 60000) continue;        // completed → skip
      upcoming++;
      console.error(`upcoming: ${mt.hT} vs ${mt.aT}`);
      if (afCalls >= AF_BUDGET) break;
      const [h, a] = await Promise.all([squad(mt.hT, now), squad(mt.aT, now)]);
      const fouls = [], shots = [];
      if (h) { fouls.push(...foulProps(mt.hT, h)); const s = shotProp(mt.hT, h); if (s) shots.push(s); }
      if (a) { fouls.push(...foulProps(mt.aT, a)); const s = shotProp(mt.aT, a); if (s) shots.push(s); }
      if (fouls.length || shots.length) out[pairKey(mt.hT, mt.aT)] = { fouls, shots, updated: new Date().toISOString() };
    }
  }
  console.error(`buildLive: ${upcoming} upcoming matches, ${Object.keys(out).length} got live props`);
  return out;
}

const res = await fetch(SRC, { headers: { 'User-Agent': 'wc26edge-refresh' } });
if (!res.ok) { console.error('feed fetch failed:', res.status, SRC); process.exit(1); }
const feed = await res.json();
const matches = feed.matches || [];
if (!matches.length) { console.error('feed has no matches; aborting (site unchanged)'); process.exit(1); }

const table = buildTable(matches);
const played = Object.values(table).reduce((n, g) => n + g.results.length, 0);
if (!Object.keys(table).length) { console.error('no groups parsed; aborting'); process.exit(1); }

const data = JSON.parse(readFileSync(DATA, 'utf8'));
data.WC_TABLE = table;

// Keep curated group-stage blocks (they link to the detailed cards); replace
// the knockout blocks with feed-derived, auto-resolving ones.
const groupBlocks = (data.FIXTURES || []).filter(b => /group/i.test(b.stage));
const koBlocks = buildKnockout(matches);
data.FIXTURES = [...groupBlocks, ...koBlocks];

// Live foul/shot props — baked server-side so the browser never calls the API.
data.LIVE = await buildLive(data, Date.now());
try { writeFileSync(CACHE, JSON.stringify(afCache)); } catch { /* cache best-effort */ }

// Freshness stamp shown in the UI so the live (free) pipeline is visible.
data.updated = new Date().toISOString();
data.source = AF_KEY ? 'openfootball (CC0) + API-Football' : 'openfootball (CC0 · free, no key)';

writeFileSync(DATA, JSON.stringify(data, null, 1));
const koGames = koBlocks.reduce((n, b) => n + b.matches.length, 0);
const liveN = Object.keys(data.LIVE || {}).length;
console.log(`Refreshed · cutoff ${CUTOFF} · ${Object.keys(table).length} groups · ${played} results · ${koBlocks.length} KO blocks (${koGames} games) · live props for ${liveN} matches · API-Football calls this run: ${afCalls}/${AF_BUDGET}`);
