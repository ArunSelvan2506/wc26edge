import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { copyText, cc, cfill } from '../lib/ui.js';
import { sweepClock } from '../lib/useSweep.js';

// Sweep banner: a countdown timer to the next 3-hour update. Shared across all
// sports.
export function SweepBanner({ now, nextSweep, live = 0 }) {
  return (
    <div className="tn-timer">
      <div className="tn-timer-l"><span className="live-dot" />{live > 0 ? `${live} live now` : 'Live model'}</div>
      <div className="tn-timer-r">↻ next update in <b>{sweepClock(nextSweep - now)}</b></div>
    </div>
  );
}

// Tappable element that copies `copy` to the clipboard.
export function Copyable({ copy, className = '', children, style, icon = true }) {
  return (
    <div
      className={'copyable ' + className}
      style={style}
      onClick={e => { e.stopPropagation(); copyText(copy); }}
      role="button"
    >
      {children}
      {icon && <span className="copy-ico">⧉</span>}
    </div>
  );
}

// Animated confidence/probability bar. Fills from 0 → p% when it mounts.
export function ConfBar({ label, p, fill, color, sub, delay = 0 }) {
  const f = fill || cfill(p);
  return (
    <div className="cbar">
      <div className="cb-hd">
        <span className="cb-lb">{label}</span>
        <span className="cb-pc" style={{ color: color || cc(p) }}>{p}%</span>
      </div>
      <div className="cb-tr">
        <motion.div
          className={'cb-fi ' + f}
          initial={{ width: 0 }}
          animate={{ width: p + '%' }}
          transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      {sub && <div className="mdl-meta">{sub}</div>}
    </div>
  );
}

// Frac / Dec odds-format switch.
export function OddsToggle({ fmt, onChange }) {
  const opts = [['frac', 'Frac'], ['dec', 'Dec']];
  return (
    <div className="odds-toggle">
      <span className="of-lbl">Odds</span>
      {opts.map(([k, l]) => (
        <button key={k} className={'of-btn' + (fmt === k ? ' active' : '')} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

// Global toast listening for `wc-toast` events.
export function Toast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let timer;
    const on = e => { setMsg(e.detail); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 1700); };
    window.addEventListener('wc-toast', on);
    return () => { window.removeEventListener('wc-toast', on); clearTimeout(timer); };
  }, []);
  return (
    <AnimatePresence>
      {msg && (
        <motion.div className="toast"
          initial={{ opacity: 0, y: 24, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 24, x: '-50%' }}
          transition={{ duration: 0.22 }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
