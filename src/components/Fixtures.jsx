import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DAYS, FIXTURES } from '../data.js';
import { norm } from '../lib/model.js';
import MatchCard from './MatchCard.jsx';

// Map a fixture's "A vs B" to the detailed match in DAYS (order-independent).
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');
function buildDetailIndex() {
  const idx = {};
  for (const k in DAYS) for (const m of DAYS[k].matches) idx[pairKey(m.hT, m.aT)] = m;
  return idx;
}

// Bucket each fixture block's stage into a filter category.
function stageCat(stage) {
  if (/group/i.test(stage)) return 'Group';
  if (/round of 32/i.test(stage)) return 'R32';
  if (/round of 16/i.test(stage)) return 'R16';
  if (/quarter/i.test(stage)) return 'QF';
  if (/semi/i.test(stage)) return 'SF';
  return 'Final'; // third place + final
}
const STAGE_CLASS = { Group: 'fs-group', R32: 'fs-r32', R16: 'fs-r16', QF: 'fs-qf', SF: 'fs-sf', Final: 'fs-final' };
const FILTERS = ['All', 'Group', 'R32', 'R16', 'QF', 'SF', 'Final'];

export default function Fixtures({ fmt, rat }) {
  const detail = useMemo(buildDetailIndex, []);
  const [filter, setFilter] = useState('All');
  const blocks = FIXTURES.filter(b => filter === 'All' || stageCat(b.stage) === filter);

  return (
    <div>
      <div className="section-h">All fixtures · World Cup 2026</div>
      <div className="chips">
        {FILTERS.map(f => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {blocks.map((b, bi) => {
        const cat = stageCat(b.stage);
        return (
          <motion.div key={b.date + b.stage} className="fix-block"
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.3, delay: Math.min(bi * 0.03, 0.2), ease: 'easeOut' }}>
            <div className="fix-block-hdr">
              <div className="fix-date">{b.date}</div>
              <span className={'fix-stage ' + (STAGE_CLASS[cat] || 'fs-group')}>{b.stage}</span>
            </div>
            {b.matches.map((mt, mi) => {
              const [a, c] = (mt.teams || '').split(/\s+vs\s+/i);
              const det = a && c ? detail[pairKey(a, c)] : null;
              return det
                ? <MatchCard key={mt.teams + mi} m={det} fmt={fmt} rat={rat} index={mi} />
                : <FixtureRow key={mt.teams + mi} mt={mt} />;
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

function FixtureRow({ mt }) {
  return (
    <div className="fix-row">
      <div className="fix-time">{mt.ist || 'TBD'}<small>IST</small></div>
      <div>
        <div className="fix-teams">{mt.teams}</div>
        {mt.grp && <div className="fix-meta">{mt.grp}</div>}
      </div>
    </div>
  );
}
