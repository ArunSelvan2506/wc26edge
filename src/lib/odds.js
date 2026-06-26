// Odds formatting — data stays American (canonical); convert at render time.
export const FRAC_LADDER = [[1,10],[1,8],[1,7],[1,6],[1,5],[2,9],[1,4],[2,7],[3,10],[1,3],[2,5],[4,9],[1,2],[8,15],[4,7],[8,13],[2,3],[8,11],[4,5],[5,6],[10,11],[1,1],[11,10],[6,5],[5,4],[11,8],[7,5],[3,2],[8,5],[13,8],[7,4],[15,8],[2,1],[9,4],[5,2],[11,4],[3,1],[10,3],[7,2],[4,1],[9,2],[5,1],[11,2],[6,1],[13,2],[7,1],[15,2],[8,1],[9,1],[10,1],[12,1],[14,1],[16,1],[18,1],[20,1],[25,1],[33,1],[40,1],[50,1]];

export function amToDec(am) {
  const n = parseFloat(String(am).replace(/[^\-+0-9.]/g, ''));
  if (!isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
export function amToProb(am) { const d = amToDec(am); return d ? 1 / d : null; }

// fmt: 'frac' | 'dec' | 'am'. Keeps any trailing book/suffix (e.g. "-155 bet365").
export function fmtOdds(odds, fmt = 'frac') {
  if (odds == null) return odds;
  const s = String(odds).trim();
  const mm = s.match(/^([+\-]?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!mm) return s;
  const n = parseFloat(mm[1]); const suf = mm[2] ? ' ' + mm[2] : '';
  if (!isFinite(n) || n === 0) return s;
  if (fmt === 'am') return s;
  const dec = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  if (fmt === 'dec') return dec.toFixed(2) + suf;
  const v = dec - 1;
  let best = FRAC_LADDER[0], err = Infinity;
  for (const f of FRAC_LADDER) { const e = Math.abs(v - f[0] / f[1]); if (e < err) { err = e; best = f; } }
  return best[0] + '/' + best[1] + suf;
}
