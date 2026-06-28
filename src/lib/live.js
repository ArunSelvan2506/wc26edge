// Live lineup lookup. LIVE is baked hourly by scripts/refresh-data.mjs from
// TheSportsDB (free, best-effort). Keyed by a sorted, normalised team pair so
// the order in a fixture string ("A vs B") doesn't matter.
import { norm } from './model.js';
import { LIVE, SQUADS } from '../data.js';

const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');

// Squad-derived foul candidates for a nation: [{name, pos}] or null. norm()
// shares the alias map used when these are baked, so lookups line up.
export function squadFor(team) {
  const list = SQUADS[norm(team)];
  return Array.isArray(list) && list.length ? list : null;
}
const hasXI = x => x && Array.isArray(x.players) && x.players.length > 0;

// Returns { a, b, fetched } where a/b are { name, players:[{name,pos,sub}],
// formation } for the queried teams — or null when no lineup is baked yet.
export function lineupFor(teamA, teamB) {
  const rec = LIVE[pairKey(teamA, teamB)];
  if (!rec || !rec.teams) return null;
  const a = rec.teams[norm(teamA)] || null;
  const b = rec.teams[norm(teamB)] || null;
  if (!hasXI(a) && !hasXI(b)) return null;
  return { a, b, fetched: rec.fetched };
}
