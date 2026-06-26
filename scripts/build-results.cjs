// Build completed results + group standings from openfootball 2026 data.
// Source: github.com/openfootball/worldcup.json (CC0). NOTE: 2026 scores are
// seed/placeholder data, so standings are illustrative, not official.
// Usage: node scripts/build-results.cjs   (writes data/worldcup-results.json)
const fs = require('fs');
const CUTOFF = '2026-06-26';                 // only games on/before "today" count as completed
const SRC = process.argv[2] || '/tmp/claude-0/-home-user-wc26edge/30254b0e-d88f-55bb-9f98-adfbd7840303/scratchpad/wc2026.json';
const d = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const ms = d.matches || [];

const groups = {};
const ensure = (g, t) => { groups[g] ??= {}; groups[g][t] ??= { team: t, p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; return groups[g][t]; };
const results = {};

for (const m of ms) {
  if (!m.group) continue;                    // group-stage only
  const g = m.group.replace(/^Group\s*/i, '').trim();
  const ft = m.score && Array.isArray(m.score.ft) ? m.score.ft : null;
  const played = ft && (!m.date || m.date <= CUTOFF);
  // make sure both teams appear in the table even if not yet played
  ensure(g, m.team1); ensure(g, m.team2);
  if (!played) continue;
  const [a, b] = ft;
  const A = ensure(g, m.team1), B = ensure(g, m.team2);
  A.p++; B.p++; A.gf += a; A.ga += b; B.gf += b; B.ga += a;
  if (a > b) { A.w++; B.l++; A.pts += 3; }
  else if (a < b) { B.w++; A.l++; B.pts += 3; }
  else { A.d++; B.d++; A.pts++; B.pts++; }
  (results[g] ??= []).push({ date: m.date, t1: m.team1, t2: m.team2, s1: a, s2: b });
}

const out = { source: 'openfootball/worldcup.json (CC0, 2026 scores are seed data)', generated: CUTOFF, cutoff: CUTOFF, groups: {} };
for (const g of Object.keys(groups).sort()) {
  const table = Object.values(groups[g]).map(t => ({ ...t, gd: t.gf - t.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team));
  out.groups[g] = { table, results: (results[g] || []).sort((a, b) => (a.date||'').localeCompare(b.date||'')) };
}
fs.writeFileSync('data/worldcup-results.json', JSON.stringify(out, null, 1));
const played = Object.values(results).reduce((n, a) => n + a.length, 0);
console.log('groups:', Object.keys(out.groups).length, '| completed results:', played);
console.log('Group A sample:', JSON.stringify(out.groups.A.table.map(t=>t.team+' '+t.pts+'pts')), out.groups.A.results.length+' games');
