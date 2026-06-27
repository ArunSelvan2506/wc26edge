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
import { CRICKET_RATINGS, fmtKey, FORMAT_LABEL } from '../src/lib/cricket.js';

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

// ── Lineups (TheSportsDB · free key) ──────────────────────────────────────
// Best-effort: confirmed XIs publish ~1h before kickoff and TheSportsDB's
// free/community coverage is patchy, so this is wrapped so ANY failure leaves
// lineups empty and the build proceeds untouched. Set TSDB_KEY to a Patreon
// key for better limits/coverage; defaults to the public test key.
const TSDB_KEY = process.env.TSDB_KEY || '3';
const TSDB_LEAGUE = process.env.TSDB_LEAGUE || '4429';   // FIFA World Cup
const TSDB_SEASON = process.env.TSDB_SEASON || '2026';

function liveNorm(name) {
  const s = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\b(and|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const A = { 'korea republic': 'south korea', 'united states': 'usa', 'cote d ivoire': 'ivory coast', 'czechia': 'czech republic', 'cabo verde': 'cape verde', 'bosnia and herzegovina': 'bosnia herzegovina' };
  return A[s] || s;
}
const liveKey = (a, b) => [liveNorm(a), liveNorm(b)].sort().join('|');

async function tsdb(path) {
  const r = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/${path}`, { headers: { 'User-Agent': 'wc26edge-refresh' } });
  if (!r.ok) throw new Error('tsdb ' + r.status);
  return r.json();
}

async function buildLineups(now) {
  const out = {};
  const season = await tsdb(`eventsseason.php?id=${TSDB_LEAGUE}&s=${TSDB_SEASON}`);
  const events = (season && season.events) || [];
  if (!events.length) { console.log('Lineups · no season events returned (skipping)'); return out; }
  // Only matches from ~1 day ago to ~2 days ahead — lineups only exist near KO,
  // and this keeps the request count low (free tier friendly).
  const lo = now - 24 * 3600e3, hi = now + 48 * 3600e3;
  const window = events.filter(e => {
    const ts = Date.parse(e.strTimestamp || e.dateEvent || '');
    return isFinite(ts) ? (ts >= lo && ts <= hi) : false;
  }).slice(0, 24);
  let baked = 0;
  for (const e of window) {
    try {
      const r = await tsdb(`lookuplineup.php?id=${e.idEvent}`);
      const rows = (r && r.lineup) || [];
      if (!rows.length) continue;
      const side = isHome => rows
        .filter(p => p.strHome === (isHome ? 'Yes' : 'No'))
        .map(p => ({ name: p.strPlayer, pos: p.strPosition || '', sub: p.strSubstitute === 'Yes' }))
        .filter(p => p.name);
      const home = side(true), away = side(false);
      if (!home.length && !away.length) continue;
      out[liveKey(e.strHomeTeam, e.strAwayTeam)] = {
        teams: {
          [liveNorm(e.strHomeTeam)]: { name: e.strHomeTeam, players: home, formation: e.strHomeFormation || '' },
          [liveNorm(e.strAwayTeam)]: { name: e.strAwayTeam, players: away, formation: e.strAwayFormation || '' },
        },
        fetched: new Date().toISOString(),
      };
      baked++;
    } catch { /* skip this event, keep going */ }
  }
  console.log(`Lineups · ${window.length} events in window · ${baked} with XIs (TheSportsDB free)`);
  return out;
}

// ── Cricket internationals (TheSportsDB · free, self-discovering) ──────────
// Finds international cricket leagues, pulls upcoming fixtures between known
// nations, and groups them by date. Returns null on any failure / no coverage
// so the curated seed in data.CRICKET is left in place.
const CRIC_NATIONS = new Set(
  Object.values(CRICKET_RATINGS).flatMap(o => Object.keys(o)).map(s => s.toLowerCase())
);

async function buildCricket(now) {
  let leagues = [];
  try {
    const r = await tsdb('search_all_leagues.php?s=Cricket');
    leagues = (r && (r.countries || r.leagues)) || [];
  } catch (e) { console.log('Cricket · league lookup failed:', e.message); return null; }
  const intl = leagues.filter(l => /international|\bODI\b|t20i|twenty20 international|test match|\bICC\b|world cup|champions trophy|tri.?series|bilateral/i.test(l.strLeague || ''));
  console.log(`Cricket · ${leagues.length} cricket leagues [${leagues.map(l => l.strLeague).join(', ')}] · ${intl.length} international`);
  const lo = now - 6 * 3600e3, hi = now + 12 * 24 * 3600e3;
  const items = [], seen = new Set();
  for (const lg of intl.slice(0, 8)) {
    try {
      const r = await tsdb(`eventsnextleague.php?id=${lg.idLeague}`);
      for (const e of (r && r.events) || []) {
        const t1 = e.strHomeTeam, t2 = e.strAwayTeam;
        if (!t1 || !t2) continue;
        if (!CRIC_NATIONS.has(t1.toLowerCase()) || !CRIC_NATIONS.has(t2.toLowerCase())) continue;
        const ts = Date.parse(e.strTimestamp || e.dateEvent || '');
        if (!isFinite(ts) || ts < lo || ts > hi) continue;
        const key = [t1, t2].sort().join('|') + (e.dateEvent || '');
        if (seen.has(key)) continue; seen.add(key);
        items.push({ ts, t1, t2, league: lg.strLeague, venue: e.strVenue || '' });
      }
    } catch { /* skip league */ }
  }
  console.log(`Cricket · ${items.length} international fixtures in window`);
  if (!items.length) return null;
  items.sort((a, b) => a.ts - b.ts);
  const blocks = [], idx = {};
  for (const x of items) {
    const date = istDateLabel(x.ts);
    if (!idx[date]) { idx[date] = { date, series: 'International', matches: [] }; blocks.push(idx[date]); }
    idx[date].matches.push({
      teams: `${x.t1} vs ${x.t2}`, t1: x.t1, t2: x.t2,
      format: FORMAT_LABEL[fmtKey(x.league)], venue: x.venue, ist: istTime(x.ts),
    });
  }
  return blocks;
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

// Lineups (best-effort, free) — any failure leaves them empty; the site is
// unaffected and simply shows no XI until coverage appears.
let live = {};
try { live = await buildLineups(Date.now()); }
catch (e) { console.warn('lineup fetch skipped:', e.message); }
data.LIVE = live;

// Cricket internationals (best-effort, free) — only overwrite the curated seed
// when TheSportsDB actually returns fixtures; otherwise leave data.CRICKET as-is.
try {
  const ckBlocks = await buildCricket(Date.now());
  if (ckBlocks && ckBlocks.length) {
    data.CRICKET = { blocks: ckBlocks, updated: new Date().toISOString(), source: 'TheSportsDB (free)' };
    console.log(`Cricket · using live fixtures (${ckBlocks.reduce((n, b) => n + b.matches.length, 0)} matches)`);
  } else {
    console.log('Cricket · keeping curated seed (no live coverage)');
  }
} catch (e) { console.warn('cricket fetch skipped:', e.message); }

// Freshness stamp shown in the UI so the live (free) pipeline is visible.
data.updated = new Date().toISOString();
data.source = 'openfootball (CC0 · free, no key)';

writeFileSync(DATA, JSON.stringify(data, null, 1));
const koGames = koBlocks.reduce((n, b) => n + b.matches.length, 0);
console.log(`Refreshed · cutoff ${CUTOFF} · ${Object.keys(table).length} groups · ${played} results · ${koBlocks.length} KO blocks (${koGames} games)`);
