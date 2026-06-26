// Auto-remove completed fixture blocks. Each FIXTURES block is dated in IST
// (e.g. "Fri 26 Jun (IST)"); a block is "completed" ~135 min after its last
// kickoff (latest IST time among its matches). IST = UTC+5:30.
import { FIXTURES } from '../data.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const COMPLETE_MS = 135 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// Last "<day> <mon>" in the block label (handles "Sat 4 & Sun 5 Jul").
function lastDate(dateStr) {
  let mo = null, day = null, m;
  const re = /(\d{1,2})\s+([A-Za-z]{3})/g;
  while ((m = re.exec(dateStr))) { day = +m[1]; mo = MONTHS[m[2].toLowerCase()]; }
  return (mo == null || day == null) ? null : { mo, day };
}

// Latest kickoff time-of-day (minutes) across a block's matches.
function maxTimeMin(matches) {
  let mx = -1;
  for (const mt of matches || []) {
    const t = (mt.ist || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!t) continue;
    let h = (+t[1]) % 12; if (/pm/i.test(t[3])) h += 12;
    const min = h * 60 + (+t[2]);
    if (min > mx) mx = min;
  }
  return mx;
}

export function blockCompleted(block, now = Date.now()) {
  const d = lastDate(block.date);
  const mm = maxTimeMin(block.matches);
  if (!d || mm < 0) return false;            // can't date it → keep it
  const kickoffUTC = Date.UTC(2026, d.mo, d.day, 0, 0) + mm * 60000 - IST_OFFSET_MS;
  return now > kickoffUTC + COMPLETE_MS;
}

export function upcomingBlocks(now = Date.now()) {
  return FIXTURES.filter(b => !blockCompleted(b, now));
}
