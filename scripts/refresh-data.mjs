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

// Player foul/shot props are curated (the free API-Football tier blocks current
// World Cup player data), so no live props are baked.
data.LIVE = {};

// Freshness stamp shown in the UI so the live (free) pipeline is visible.
data.updated = new Date().toISOString();
data.source = 'openfootball (CC0 · free, no key)';

writeFileSync(DATA, JSON.stringify(data, null, 1));
const koGames = koBlocks.reduce((n, b) => n + b.matches.length, 0);
console.log(`Refreshed · cutoff ${CUTOFF} · ${Object.keys(table).length} groups · ${played} results · ${koBlocks.length} KO blocks (${koGames} games)`);
