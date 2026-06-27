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
import { CRICKET_NATIONS, fmtKey, FORMAT_LABEL } from '../src/lib/cricket.js';

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

// ── Cricket internationals (CricketData.org · free tier, needs CRICKET_API_KEY) ──
// Pulls upcoming matches, keeps the internationals (both sides are nations we
// rate), and groups them by date. Returns null with no key / on failure so the
// curated seed stays in place.
const CRIC_NATIONS = new Set(CRICKET_NATIONS.map(s => s.toLowerCase()));
const CRIC_KEY = process.env.CRICKET_API_KEY || '';
// "India Women" / "Australia W" → { nation:'india', gender:'women' }; men otherwise.
function cricTeam(name) {
  const raw = String(name || '').trim();
  const women = /\bwomen\b|\bw\b|\(w\)|women'?s/i.test(raw);
  const nation = raw.replace(/\bwomen'?s?\b|\(w\)|\bw\b/ig, '').replace(/\s+/g, ' ').trim();
  return { nation, women };
}
function cricFormat(matchType) {
  const t = String(matchType || '').toLowerCase();
  if (t.includes('test')) return 'Test';
  if (t.includes('odi')) return 'ODI';
  return 'T20I';
}

async function buildCricket(now) {
  if (!CRIC_KEY) { console.log('Cricket · no CRICKET_API_KEY set (keeping curated seed)'); return null; }
  let matches = [];
  try {
    for (const offset of [0, 25, 50]) {
      const r = await fetch(`https://api.cricapi.com/v1/matches?apikey=${CRIC_KEY}&offset=${offset}`, { headers: { 'User-Agent': 'wc26edge-refresh' } });
      const j = await r.json();
      if (j.status !== 'success') { console.log('Cricket API:', j.status, j.reason || j.message || ''); break; }
      const page = j.data || [];
      matches.push(...page);
      if (page.length < 25) break;
    }
  } catch (e) { console.log('Cricket API failed:', e.message); return null; }

  const lo = now - 6 * 3600e3, hi = now + 14 * 24 * 3600e3;
  const items = [], seen = new Set();
  let nationFail = 0, windowFail = 0, parseFail = 0;
  // DIAGNOSTIC (temporary): show what the feed returns.
  for (const m of matches.slice(0, 10)) console.log(`  CK? "${m.name}" | type=${m.matchType} | ${m.dateTimeGMT} | teams=${JSON.stringify(m.teams)}`);
  for (const m of matches) {
    const names = m.teams && m.teams.length >= 2 ? m.teams : (m.teamInfo || []).map(t => t.name);
    if (!names || names.length < 2) { nationFail++; continue; }
    const a = cricTeam(names[0]), b = cricTeam(names[1]);
    if (!CRIC_NATIONS.has(a.nation.toLowerCase()) || !CRIC_NATIONS.has(b.nation.toLowerCase())) { nationFail++; continue; }
    const gmt = (m.dateTimeGMT || '').replace(' ', 'T');
    const ts = Date.parse(gmt + (gmt && !/[zZ]|[+-]\d\d:?\d\d$/.test(gmt) ? 'Z' : ''));
    if (!isFinite(ts)) { parseFail++; continue; }
    if (ts < lo || ts > hi) { windowFail++; continue; }
    const key = m.id || (a.nation + b.nation + gmt);
    if (seen.has(key)) continue; seen.add(key);
    const gender = a.women || b.women ? 'women' : 'men';
    items.push({ ts, t1: a.nation, t2: b.nation, gender, format: cricFormat(m.matchType), venue: m.venue || '' });
  }
  console.log(`Cricket · ${matches.length} fetched · ${items.length} in window · rejected: nation ${nationFail}, window ${windowFail}, parse ${parseFail}`);
  if (!items.length) return null;
  items.sort((a, b) => a.ts - b.ts);
  const blocks = [], idx = {};
  for (const x of items) {
    const date = istDateLabel(x.ts);
    if (!idx[date]) { idx[date] = { date, series: 'International', matches: [] }; blocks.push(idx[date]); }
    idx[date].matches.push({
      teams: `${x.t1} vs ${x.t2}`, t1: x.t1, t2: x.t2, gender: x.gender,
      format: x.format, venue: x.venue, ist: istTime(x.ts),
    });
  }
  return blocks;
}

// ── Formula 1 (Jolpica-F1 · free Ergast successor, no key) ────────────────
// Pulls the CURRENT season driver standings, the next race, and recent
// finishing form. Returns null on any failure so the curated grid stands.
const JF1 = process.env.JOLPICA || 'https://api.jolpi.ca/ergast/f1';
async function jf1(path) {
  const r = await fetch(`${JF1}/${path}`, { headers: { 'User-Agent': 'wc26edge-refresh' } });
  if (!r.ok) throw new Error('jolpica ' + r.status);
  return r.json();
}

async function buildF1(now) {
  const season = new Date(now).getUTCFullYear();
  let standings = [], curRound = null;
  try {
    const list = (await jf1(`${season}/driverstandings/?format=json`))?.MRData?.StandingsTable?.StandingsLists?.[0];
    standings = list?.DriverStandings || [];
    curRound = +list?.round || null;
  } catch (e) { console.log('F1 · standings fetch failed:', e.message); return null; }
  if (!standings.length) { console.log(`F1 · no ${season} standings yet (keeping curated)`); return null; }

  // Next race from the schedule.
  let races = [];
  try { races = (await jf1(`${season}/?format=json`))?.MRData?.RaceTable?.Races || []; } catch { /* schedule optional */ }
  const today = new Date(now).toISOString().slice(0, 10);
  const next = races.find(x => x.date >= today) || races[races.length - 1] || null;

  // Recent finishing form: fetch the last up-to-5 COMPLETED rounds individually,
  // newest first (Jolpica caps /results limit at 100 and returns oldest-first,
  // so a bulk call would miss the latest races).
  const form = {};
  if (curRound) {
    for (let rnd = curRound; rnd >= Math.max(1, curRound - 4); rnd--) {
      try {
        const race = (await jf1(`${season}/${rnd}/results/?format=json`))?.MRData?.RaceTable?.Races?.[0];
        for (const res of race?.Results || []) (form[res.Driver.familyName] ??= []).push(res.positionText);
      } catch { /* skip round */ }
    }
  }

  const maxPts = Math.max(1, ...standings.map(s => +s.points || 0));
  const drivers = {};
  for (const s of standings) {
    const name = `${s.Driver.givenName} ${s.Driver.familyName}`;
    drivers[name] = {
      r: Math.round(50 + 50 * ((+s.points || 0) / maxPts)),
      team: s.Constructors?.[0]?.name || '',
      pts: +s.points || 0, pos: +s.position || null, wins: +s.wins || 0,
      form: form[s.Driver.familyName] || null,
    };
  }
  const field = standings.slice(0, 12).map(s => `${s.Driver.givenName} ${s.Driver.familyName}`);
  const koMs = next ? Date.parse(`${next.date}T${next.time || '12:00:00Z'}`) : null;
  const circuit = next?.Circuit?.Location?.locality || next?.Circuit?.circuitName || '';
  const event = {
    date: koMs && isFinite(koMs) ? istDateLabel(koMs) : '',
    series: next ? `${next.raceName}${circuit ? ' · ' + circuit : ''}` : `${season} Championship`,
    field,
  };
  console.log(`F1 · ${standings.length} drivers · leader ${standings[0]?.Driver?.familyName} ${standings[0]?.points}pts · next: ${event.series}`);
  return { drivers, event, season, updated: new Date().toISOString() };
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
    data.CRICKET = { blocks: ckBlocks, updated: new Date().toISOString(), source: 'CricketData.org' };
    console.log(`Cricket · using live fixtures (${ckBlocks.reduce((n, b) => n + b.matches.length, 0)} matches)`);
  } else {
    console.log('Cricket · keeping curated seed (no live coverage)');
  }
} catch (e) { console.warn('cricket fetch skipped:', e.message); }

// Formula 1 — current-season standings (best-effort, free). Keeps the curated
// grid if the feed is unavailable.
try {
  const f1 = await buildF1(Date.now());
  if (f1 && Object.keys(f1.drivers).length) {
    data.F1 = f1;
    console.log(`F1 · using live ${f1.season} standings (${Object.keys(f1.drivers).length} drivers)`);
  } else {
    console.log('F1 · keeping curated grid (no live standings)');
  }
} catch (e) { console.warn('F1 fetch skipped:', e.message); }

// Freshness stamp shown in the UI so the live (free) pipeline is visible.
data.updated = new Date().toISOString();
data.source = 'openfootball (CC0 · free, no key)';

writeFileSync(DATA, JSON.stringify(data, null, 1));
const koGames = koBlocks.reduce((n, b) => n + b.matches.length, 0);
console.log(`Refreshed · cutoff ${CUTOFF} · ${Object.keys(table).length} groups · ${played} results · ${koBlocks.length} KO blocks (${koGames} games)`);
