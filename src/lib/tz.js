// Timezone helpers — convert a UTC timestamp to the user's chosen region for
// display and day-grouping. Uses Intl so it's DST-correct, no tables.

export const ZONES = [
  { id: 'Asia/Kolkata', label: 'IST' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Europe/London', label: 'UK' },
  { id: 'America/New_York', label: 'ET' },
  { id: 'America/Los_Angeles', label: 'PT' },
  { id: 'Australia/Sydney', label: 'AEST' },
  { id: 'Asia/Dubai', label: 'GST' },
];
export const zoneLabel = id => (ZONES.find(z => z.id === id) || ZONES[0]).label;

const _f = {};
const fmt = (tz, opts) => (_f[tz + JSON.stringify(opts)] ||= new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }));

const ms = u => (typeof u === 'number' ? u : Date.parse(u));

// "3:30pm"
export function timeIn(utc, tz) {
  const t = ms(utc); if (!isFinite(t)) return null;
  return fmt(tz, { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(t)).replace(/\s/g, '').toLowerCase();
}
// "2026-06-28" (sortable day key in the chosen zone)
export function dayKeyIn(utc, tz) {
  const t = ms(utc); if (!isFinite(t)) return null;
  const p = {}; for (const x of fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
// "Sun 28 Jun"
export function dayLabelIn(utc, tz) {
  const t = ms(utc); if (!isFinite(t)) return null;
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(t));
}
