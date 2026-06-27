// Per-match completion (robust). Each fixture's kickoff = its IST clock time
// (m.ist, which may carry a weekday prefix like "Sun 3:30am") on the matching
// date from the block label (e.g. "Sat 4 & Sun 5 Jul (IST)"). IST = UTC+5:30.
// A game is "completed" ~135 min after kickoff and drops from the list; blocks
// with no upcoming games drop entirely.
import { FIXTURES } from '../data.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const COMPLETE_MS = 135 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// Parse all "<weekday> <day> [<mon>]" entries in a block label; the month is
// forward-filled (e.g. "Sat 4 & Sun 5 Jul" → both July).
function blockDates(dateStr) {
  const out = [];
  const re = /([A-Za-z]{3,})\s+(\d{1,2})(?:\s+([A-Za-z]{3,}))?/g;
  let m;
  while ((m = re.exec(dateStr))) {
    const wd = m[1].slice(0, 3).toLowerCase();
    if (!WD.includes(wd)) continue;                       // skip stray tokens like "IST"
    out.push({ wd, day: +m[2], mon: m[3] ? MONTHS[m[3].slice(0, 3).toLowerCase()] : null });
  }
  let lastMon = null;
  for (let i = out.length - 1; i >= 0; i--) { if (out[i].mon != null) lastMon = out[i].mon; else out[i].mon = lastMon; }
  return out;
}

function kickoffUTC(block, mt) {
  const dates = blockDates(block.date);
  if (!dates.length) return null;
  const ist = mt.ist || '';
  let d = dates[0];
  const wdm = ist.match(/^([A-Za-z]{3})/);                // weekday prefix → pick that date
  if (wdm) { const f = dates.find(x => x.wd === wdm[1].toLowerCase()); if (f) d = f; }
  const tm = ist.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!tm || d.mon == null) return null;
  let h = (+tm[1]) % 12; if (/pm/i.test(tm[3])) h += 12;
  return Date.UTC(2026, d.mon, d.day, h, +tm[2]) - IST_OFFSET_MS;
}

export function matchCompleted(block, mt, now = Date.now()) {
  if (mt.done) return true;
  // Feed-derived fixtures carry an exact kickoff timestamp; curated ones are
  // parsed from their IST clock time.
  const ko = (typeof mt.koUTC === 'number') ? mt.koUTC : kickoffUTC(block, mt);
  if (ko == null) return false;                           // can't time it → keep it
  return now > ko + COMPLETE_MS;
}

// Blocks with only their still-upcoming matches; empty blocks removed.
export function upcomingFixtures(now = Date.now()) {
  return FIXTURES
    .map(b => ({ ...b, matches: b.matches.filter(mt => !matchCompleted(b, mt, now)) }))
    .filter(b => b.matches.length);
}
