// Live data refresh (no API key). Pulls the openfootball World Cup 2026 feed
// and regenerates ONLY the standings + completed results (WC_TABLE) inside
// src/data.json. Curated match cards (DAYS), the schedule (FIXTURES) and
// baselines (OG_STATS) are left untouched. The model refits from the new
// results automatically at runtime.
//
// Usage: node scripts/refresh-data.mjs   (npm run refresh)
import { readFileSync, writeFileSync } from 'fs';

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
writeFileSync(DATA, JSON.stringify(data, null, 1));
console.log(`Refreshed WC_TABLE from openfootball · cutoff ${CUTOFF} · ${Object.keys(table).length} groups · ${played} completed results`);
