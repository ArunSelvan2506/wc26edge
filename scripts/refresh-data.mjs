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

// ── Squad rosters → projected foulers (TheSportsDB · free) ────────────────
// Confirmed XIs only publish ~1h before kickoff, so for ties further out we
// name the likely foulers from each nation's squad (defenders & midfielders
// commit most fouls; keepers & forwards least). Each WC nation is found by name
// search, then its roster is pulled. Refreshed at most once a day and persisted
// between runs — squads barely change, so this stays cheap.
const FOUL_POS = /def.*mid|holding|back|defen|\bcb\b|\blb\b|\brb\b|\bwb\b|\bcdm\b|\bdm\b|midfield/i;
const NOT_SENIOR = /women|u-?\d\d|under-?\d\d|olympic|futsal|beach|youth/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function buildSquads(now, existing, nations) {
  // Skip the refetch only if we already hold rosters for the actual WC nations
  // (guards against a stale/wrong cache) and it isn't the daily refresh hour.
  const valid = existing && nations.some(n => existing[liveNorm(n)]);
  if (valid && new Date(now).getUTCHours() !== 3) return existing;
  const out = {};
  let got = 0;
  for (const nation of nations) {
    try {
      const teams = (await tsdb(`searchteams.php?t=${encodeURIComponent(nation)}`))?.teams || [];
      const cand = teams.filter(t => t.strSport === 'Soccer' && !NOT_SENIOR.test(t.strTeam || ''));
      const team = cand.find(t => liveNorm(t.strTeam) === liveNorm(nation)) || cand[0];
      await sleep(700);                                  // gentle on the shared free key
      if (!team) continue;
      const players = (await tsdb(`lookup_all_players.php?id=${team.idTeam}`))?.player || [];
      const foulers = players
        .filter(p => p.strPlayer && FOUL_POS.test(p.strPosition || ''))
        .map(p => ({ name: p.strPlayer, pos: p.strPosition || '' }))
        .slice(0, 8);
      if (foulers.length) { out[liveNorm(nation)] = foulers; got++; }
      await sleep(700);
    } catch { /* skip nation, keep going */ }
  }
  console.log(`Squads · ${nations.length} nations queried · ${got} with rosters (TheSportsDB free)`);
  return Object.keys(out).length ? out : (existing || {});
}

// ── Cricket internationals (CricketData.org · free tier, needs CRICKET_API_KEY) ──
// Pulls upcoming matches, keeps the internationals (both sides are nations we
// rate), and groups them by date. Returns null with no key / on failure so the
// curated seed stays in place.
const CRIC_NATIONS = new Set(CRICKET_NATIONS.map(s => s.toLowerCase()));
const CRIC_KEY = process.env.CRICKET_API_KEY || '';
// "India [IND]" → {nation:'india'}; "Australia Women" → {nation, women:true};
// "India A [INA]" / "India U19 [IN19]" → flagged exclude (not a senior team).
function cricTeam(name) {
  // Drop bracketed codes like " [ENG]", " [IND-A]", " [IN19]".
  const s = String(name || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  const women = /\bwomen\b|\bwmn\b|\(w\)/i.test(s);
  const noW = s.replace(/\bwomen'?s?\b|\(w\)/ig, ' ').replace(/\s+/g, ' ').trim();
  const exclude = /\bu-?19\b|\bunder[-\s]?19\b|(^|\s)A(\s|$)|\bemerging\b|\bdevelopment\b/i.test(noW);
  const nation = noW.replace(/\bu-?19\b|\bunder[-\s]?19\b/ig, '').replace(/(^|\s)A(\s|$)/i, ' ').replace(/\s+/g, ' ').trim();
  return { nation, women, exclude };
}
function cricFormat(matchType) {
  const t = String(matchType || '').toLowerCase();
  if (t.includes('test')) return 'Test';
  if (t.includes('odi')) return 'ODI';
  return 'T20I';
}

async function cric(path) {
  const r = await fetch(`https://api.cricapi.com/v1/${path}${path.includes('?') ? '&' : '?'}apikey=${CRIC_KEY}`, { headers: { 'User-Agent': 'wc26edge-refresh' } });
  return r.json();
}
const cricDone = s => /won by|\bbeat\b|\bdrawn\b|match tied|\btied\b|abandoned|no result/i.test(s || '');

async function buildCricket(now, existing) {
  if (!CRIC_KEY) { console.log('Cricket · no CRICKET_API_KEY set (keeping curated seed)'); return null; }
  const raw = [], statusById = {};

  // cricScore — cheap (1 call), every run: live/near scores + statuses.
  try {
    const j = await cric('cricScore');
    if (j.status === 'success') for (const m of (j.data || [])) {
      raw.push({ id: m.id, teams: [m.t1, m.t2], matchType: m.matchType, dateTimeGMT: m.dateTimeGMT, venue: m.series || '', status: m.status || '' });
      if (m.id) statusById[m.id] = m.status || '';
    } else console.log('Cricket cricScore:', j.status, j.reason || j.message || '');
  } catch (e) { console.log('Cricket cricScore failed:', e.message); }

  // Full series schedules — comprehensive coverage + reliable formats. Gated to
  // 4×/day (quota), or whenever we have no fixtures yet. Light hours reuse the
  // persisted fixtures and just refresh status (completed drop off hourly).
  const haveExisting = existing && existing.blocks && existing.blocks.length;
  const deep = (new Date(now).getUTCHours() % 6 === 0) || !haveExisting;
  if (deep) {
    try {
      const today = new Date(now).toISOString().slice(0, 10);
      const horizon = new Date(now + 120 * 864e5).toISOString().slice(0, 10);
      let series = [];
      for (const off of [0, 25, 50]) {
        const j = await cric(`series?offset=${off}`);
        if (j.status !== 'success') break;
        series.push(...(j.data || []));
        if ((j.data || []).length < 25) break;
      }
      const dom = /\b(IPL|BBL|CPL|PSL|SA20|ILT20|Hundred|T10|Super Smash|Vitality Blast|County|Sheffield|Ranji|Plunket|Premier League|U19|Under.19|Emerging|Academy)\b/i;
      const intl = series.filter(s => {
        const nm = String(s.name || '');
        const future = (!s.endDate || s.endDate >= today) && (!s.startDate || s.startDate <= horizon);
        const hasNation = [...CRIC_NATIONS].some(n => n.length > 3 && nm.toLowerCase().includes(n));
        const looksIntl = hasNation || /tour|trophy|world cup|champions|tri.?series|asia cup|ashes/i.test(nm);
        return future && looksIntl && !dom.test(nm);
      }).slice(0, 10);
      console.log(`Cricket · ${series.length} series · ${intl.length} international shortlisted`);
      for (const s of intl) {
        try {
          const j = await cric(`series_info?id=${s.id}`);
          for (const m of (j?.data?.matchList || [])) raw.push({ id: m.id, teams: m.teams || [], matchType: m.matchType, dateTimeGMT: m.dateTimeGMT, venue: m.venue || s.name, status: m.status || '' });
        } catch { /* skip series */ }
      }
    } catch (e) { console.log('Cricket series fetch failed:', e.message); }
  } else if (haveExisting) {
    for (const b of existing.blocks) for (const m of b.matches) raw.push({ id: m.id, teams: [m.t1, m.t2], utc: m.utc, gender: m.gender, matchType: m.format, venue: m.venue, status: statusById[m.id] || '' });
    console.log('Cricket · light run (cricScore + persisted fixtures; full series every 6h)');
  }
  if (!raw.length) { console.log('Cricket · no matches from API (keeping existing)'); return null; }

  // Filter to upcoming senior internationals; dedup by id preferring an entry
  // that carries a real format (series_info) over cricScore's blank type.
  const lo = now - 12 * 3600e3, hi = now + 120 * 24 * 3600e3;
  const byKey = {};
  for (const m of raw) {
    const names = m.teams && m.teams.length >= 2 ? m.teams : [];
    if (names.length < 2 || !names[0] || !names[1]) continue;
    if (cricDone(m.status || statusById[m.id] || '')) continue;               // drop completed
    const a = cricTeam(names[0]), b = cricTeam(names[1]);
    if (a.exclude || b.exclude) continue;                                     // drop A-teams / U19
    if (!CRIC_NATIONS.has(a.nation.toLowerCase()) || !CRIC_NATIONS.has(b.nation.toLowerCase())) continue;
    let ts = m.utc;
    if (ts == null) { const gmt = (m.dateTimeGMT || '').replace(' ', 'T'); ts = Date.parse(gmt + (gmt && !/[zZ]|[+-]\d\d:?\d\d$/.test(gmt) ? 'Z' : '')); }
    if (!isFinite(ts) || ts < lo || ts > hi) continue;
    const fmtKnown = /test|odi|t20/i.test(m.matchType || '');
    const rec = { id: m.id, ts, t1: a.nation, t2: b.nation, gender: a.women || b.women ? 'women' : 'men', format: cricFormat(m.matchType), fmtKnown, venue: m.venue || '' };
    const key = m.id || (a.nation + b.nation + Math.round(ts / 36e5));
    if (!byKey[key] || (rec.fmtKnown && !byKey[key].fmtKnown)) byKey[key] = rec;
  }
  const items = Object.values(byKey).sort((a, b) => a.ts - b.ts);
  const women = items.filter(i => i.gender === 'women').length;
  console.log(`Cricket · ${items.length} internationals (${women} women's) in 120d window`);
  if (!items.length) return null;
  const blocks = [], idx = {};
  for (const x of items) {
    const date = istDateLabel(x.ts);
    if (!idx[date]) { idx[date] = { date, series: 'International', matches: [] }; blocks.push(idx[date]); }
    idx[date].matches.push({
      id: x.id, teams: `${x.t1} vs ${x.t2}`, t1: x.t1, t2: x.t2, gender: x.gender,
      format: x.format, venue: x.venue, ist: istTime(x.ts), utc: x.ts,
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

  // Next race from the schedule — the first race that hasn't started yet, so a
  // race already under way (or finished) on its day rolls over to the next round.
  let races = [];
  try { races = (await jf1(`${season}/?format=json`))?.MRData?.RaceTable?.Races || []; } catch { /* schedule optional */ }
  const raceStart = r => Date.parse(`${r.date}T${r.time || '13:00:00Z'}`);
  const next = races.find(x => { const s = raceStart(x); return isFinite(s) ? s > now : x.date > new Date(now).toISOString().slice(0, 10); })
    || races[races.length - 1] || null;

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
    utc: koMs && isFinite(koMs) ? koMs : null,
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

// Squad rosters → projected foulers (best-effort, free). Persisted between runs
// and only refreshed once/day, so a failure simply keeps yesterday's rosters.
const wcNations = [...new Set(Object.values(table).flatMap(g => (g.table || []).map(r => r.team)))];
try { data.SQUADS = await buildSquads(Date.now(), data.SQUADS || {}, wcNations); }
catch (e) { console.warn('squad fetch skipped:', e.message); data.SQUADS = data.SQUADS || {}; }

// Cricket internationals (best-effort, free) — only overwrite the curated seed
// when TheSportsDB actually returns fixtures; otherwise leave data.CRICKET as-is.
try {
  const ckBlocks = await buildCricket(Date.now(), data.CRICKET);
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
