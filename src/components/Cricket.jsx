import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CRICKET } from '../data.js';
import { fmtOdds } from '../lib/odds.js';
import { cricketMarket, FORMAT_LABEL, fmtKey } from '../lib/cricket.js';
import { cpill } from '../lib/ui.js';
import { Copyable } from './Bits.jsx';

const FORMATS = ['All', 'Test', 'ODI', 'T20I'];
const FMT_CLASS = { test: 'cf-test', odi: 'cf-odi', t20i: 'cf-t20' };

export default function Cricket({ fmt }) {
  const blocks = CRICKET.blocks || [];
  const [filter, setFilter] = useState('All');

  const view = useMemo(() => blocks.map(b => ({
    ...b,
    matches: b.matches.filter(m => filter === 'All' || FORMAT_LABEL[fmtKey(m.format)] === filter),
  })).filter(b => b.matches.length), [blocks, filter]);

  return (
    <div>
      <div className="section-h">International cricket · match-winner odds</div>
      <div className="live-badge">
        <span className="live-dot" /> Model-derived fair odds · whole win market
      </div>
      <div className="chips">
        {FORMATS.map(f => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {view.length === 0 && (
        <div className="no-matches">No upcoming international fixtures in this format.</div>
      )}

      {view.map((b, bi) => (
        <motion.div key={b.date + bi} className="fix-block"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.3, delay: Math.min(bi * 0.04, 0.2), ease: 'easeOut' }}>
          <div className="fix-block-hdr">
            <div className="fix-date">{b.date}</div>
            {b.series && <span className="fix-stage fs-group">{b.series}</span>}
          </div>
          {b.matches.map((m, mi) => <CricketCard key={m.teams + mi} m={m} fmt={fmt} index={mi} />)}
        </motion.div>
      ))}

      <div className="ref-box" style={{ marginTop: 4 }}>
        Win probabilities come from curated, format-specific strength ratings (approx ICC ranking points — illustrative, not official) via a logistic model; Tests include a draw outcome scaled by how evenly matched the sides are. Odds shown are <b>fair</b> (no bookmaker margin). Estimates for entertainment, not guarantees.
      </div>
    </div>
  );
}

function CricketCard({ m, fmt, index = 0 }) {
  const mk = cricketMarket(m.t1, m.t2, m.format);
  const f = mk.format;
  const pc = x => Math.round(x * 100);
  const fav = mk.pA >= mk.pB ? m.t1 : m.t2;
  const favP = Math.max(mk.pA, mk.pB);
  const conf = pc(favP);

  const outcomes = [
    { label: m.t1, p: mk.pA, odds: mk.oddsA },
    ...(f === 'test' ? [{ label: 'Draw', p: mk.pDraw, odds: mk.oddsDraw }] : []),
    { label: m.t2, p: mk.pB, odds: mk.oddsB },
  ];

  return (
    <motion.div className="ck-card"
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.2), ease: 'easeOut' }}>
      <div className="ck-head">
        <div>
          <div className="ck-teams">{m.teams}</div>
          <div className="ck-meta">
            <span className={'ck-fmt ' + (FMT_CLASS[f] || '')}>{FORMAT_LABEL[f]}</span>
            {m.venue} · {m.ist}<small>IST</small>
          </div>
        </div>
        <span className={'conf-pill ' + cpill(conf)}>{fav} {conf}%</span>
      </div>
      <div className={'ck-mkt' + (f === 'test' ? ' three' : '')}>
        {outcomes.map((o, i) => (
          <Copyable key={i} className={'ck-out' + (o.label === fav ? ' fav' : '')} icon={false}
            copy={`${o.label} to win @ ${fmtOdds(o.odds, fmt)} (model ${pc(o.p)}%)`}>
            <div className="ck-out-l">{o.label}</div>
            <div className="ck-out-o">{fmtOdds(o.odds, fmt)}</div>
            <div className="ck-out-p">{pc(o.p)}%</div>
          </Copyable>
        ))}
      </div>
    </motion.div>
  );
}
