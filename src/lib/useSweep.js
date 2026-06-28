// Shared 3-hour "sweep": a ticking clock that re-renders so time-based filters
// re-evaluate, plus a countdown to the next 3-hour boundary. Used by every
// sport view to drop completed matches automatically.
import { useEffect, useState } from 'react';

export const SWEEP_MS = 3 * 3600e3;

// Typical match durations (hours) after start, by sport/format, for marking a
// fixture "completed" client-side between data refreshes.
export const DONE_HRS = {
  football: 2.25, basketball: 2.75, tennis3: 2.2, tennis5: 3.6,
  test: 120, odi: 8.5, t20i: 3.5,
};

export function useSweep() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return { now, nowMin: Math.floor(now / 60000), nextSweep: Math.ceil(now / SWEEP_MS) * SWEEP_MS };
}

// True once a fixture starting at `utc` has run its expected duration.
export function isDone(utc, hrs, now) {
  const t = typeof utc === 'number' ? utc : Date.parse(utc);
  if (!isFinite(t) || !hrs) return false;            // no time/duration → keep it
  return now > t + hrs * 3600e3;
}

// "00:42:17"
export function sweepClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
