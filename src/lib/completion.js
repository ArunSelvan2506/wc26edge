// Auto-remove completed matches. A match's kickoff is its ET clock time
// (m.time) on the day's ET date (DATES[].etNote); June ET = EDT = UTC-4. A match
// is "completed" ~135 min after kickoff. Completed matches drop from the day
// list, and any date whose matches are ALL completed drops from the picker.
import { DATES, DAYS } from '../data.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const COMPLETE_MS = 135 * 60 * 1000;

function matchKickoff(key, mt) {
  const de = DATES.find(x => x.key === key);
  const dm = de && de.etNote && de.etNote.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  const tm = (mt.time || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*ET/i);
  if (!dm || !tm) return null;
  let hr = (+tm[1]) % 12; if (/pm/i.test(tm[3])) hr += 12;
  return Date.UTC(2026, MONTHS[dm[2].toLowerCase()], +dm[1], hr + 4, tm[2] ? +tm[2] : 0);
}

export function isCompleted(key, mt, now = Date.now()) {
  if (mt.live) return false;
  if (mt.done) return true;            // explicit override
  const ko = matchKickoff(key, mt);
  return ko != null && now > ko + COMPLETE_MS;
}

export function shownMatches(key, showDone, now = Date.now()) {
  const day = DAYS[key]; if (!day) return [];
  return showDone ? day.matches : day.matches.filter(mt => !isCompleted(key, mt, now));
}

export function doneCount(key, now = Date.now()) {
  const day = DAYS[key]; if (!day) return 0;
  return day.matches.filter(mt => isCompleted(key, mt, now)).length;
}

// Keep a date in the picker if it has no detail data yet (future) or still has
// at least one non-completed match.
export function dateActive(key, now = Date.now()) {
  const day = DAYS[key]; if (!day) return true;
  return day.matches.some(mt => !isCompleted(key, mt, now));
}

export function activeDates(now = Date.now()) {
  return DATES.filter(d => dateActive(d.key, now));
}

export function firstActiveKey(now = Date.now()) {
  const d = DATES.find(x => dateActive(x.key, now));
  return d ? d.key : (DATES[0] && DATES[0].key);
}
