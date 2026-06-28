import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DAYS, UPDATED } from '../data.js';
import { norm, markets } from '../lib/model.js';
import { probToAm, dec } from '../lib/sportEngine.js';
import { fmtOdds } from '../lib/odds.js';
import { timeIn, dayLabelIn, zoneLabel } from '../lib/tz.js';
import { upcomingFixtures } from '../lib/completion.js';
import { lineupFor } from '../lib/live.js';
import { cpill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar } from './Bits.jsx';
import { Lineups } from './Lineups.jsx';
import MatchCard from './MatchCard.jsx';

function freshLabel(iso) {
  if (!iso) return 'free feed';
  const d = new Date(iso);
  if (isNaN(d)) return 'free feed';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${d.getUTCDate()} ${mon} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

// Live countdown to the next hourly auto-update (cron fires at :00 UTC).
function NextUpdate() {
  const calc = () => 3600000 - (Date.now() % 3600000);
  const [ms, setMs] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return <span className="live-meta">· next in {m}:{String(s).padStart(2, '0')}</span>;
}

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
const FILTERS = ['R32', 'R16', 'QF', 'SF', 'Final'];

export default function Fixtures({ fmt, rat, tz = 'Asia/Kolkata' }) {
  const detail = useMemo(buildDetailIndex, []);
  // Completed date-blocks drop off; recomputed once per mount.
  const upcoming = useMemo(() => upcomingFixtures(Date.now()), []);
  const [filter, setFilter] = useState('R32');
  const blocks = upcoming.filter(b => stageCat(b.stage) === filter);

  return (
    <div>
      <div className="section-h">Upcoming fixtures · World Cup 2026</div>
      <div className="live-badge">
        <span className="live-dot" /> Updated {freshLabel(UPDATED)}
        <NextUpdate />
      </div>
      <div className="chips">
        {FILTERS.map(f => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="no-matches">No upcoming fixtures in this stage. Completed games drop off automatically — check the Standings tab for results.</div>
      )}

      {blocks.map((b, bi) => {
        const cat = stageCat(b.stage);
        const ko0 = b.matches.find(m => m.koUTC != null);
        const dateLabel = ko0 ? dayLabelIn(ko0.koUTC, tz) : b.date;
        return (
          <motion.div key={b.date + b.stage} className="fix-block"
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.3, delay: Math.min(bi * 0.03, 0.2), ease: 'easeOut' }}>
            <div className="fix-block-hdr">
              <div className="fix-date">{dateLabel}</div>
              <span className={'fix-stage ' + (STAGE_CLASS[cat] || 'fs-group')}>{b.stage}</span>
            </div>
            {b.matches.map((mt, mi) => {
              const [a, c] = (mt.teams || '').split(/\s+vs\s+/i);
              const det = a && c ? detail[pairKey(a, c)] : null;
              return det
                ? <MatchCard key={mt.teams + mi} m={det} fmt={fmt} rat={rat} index={mi} />
                : <KnockoutCard key={mt.teams + mi} mt={mt} rat={rat} fmt={fmt} tz={tz} index={mi} />;
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

// Knockout fixture: shows model win odds when both teams are resolved & rated;
// otherwise a plain row (e.g. an unresolved bracket slot like "3A/B/C/D/F").
function KnockoutCard({ mt, rat, fmt, tz, index = 0 }) {
  const [a, c] = (mt.teams || '').split(/\s+vs\s+/i);
  const lu = a && c ? lineupFor(a, c) : null;
  const [open, setOpen] = useState(false);
  const time = mt.koUTC != null ? timeIn(mt.koUTC, tz) : (mt.ist || 'TBD');
  const zone = mt.koUTC != null ? zoneLabel(tz) : 'IST';
  const rated = rat && a && c && (rat.has(a) || rat.has(c));

  const lineupPanel = (
    <AnimatePresence initial={false}>
      {open && lu && (
        <motion.div className="lineup-panel"
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}>
          <Lineups lu={lu} teamA={a} teamB={c} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!rated) {
    return (
      <div className="fix-row-wrap">
        <div className={'fix-row' + (lu ? ' tappable' : '')} onClick={() => lu && setOpen(o => !o)}>
          <div className="fix-time">{time}<small>{zone}</small></div>
          <div>
            <div className="fix-teams">{mt.teams}</div>
            {mt.grp && <div className="fix-meta">{mt.grp}</div>}
          </div>
          {lu && <span className="lineup-tag">XI {open ? '▴' : '▾'}</span>}
        </div>
        {lineupPanel}
      </div>
    );
  }

  const mk = markets(rat, a, c);
  const pc = x => Math.round(x * 100);
  const fav = mk.home >= mk.away ? a : c;
  const conf = pc(Math.max(mk.home, mk.away));
  const outs = [
    { label: a, p: mk.home, am: probToAm(mk.home) },
    { label: 'Draw', p: mk.draw, am: probToAm(mk.draw) },
    { label: c, p: mk.away, am: probToAm(mk.away) },
  ];
  return (
    <div className="fix-row-wrap">
      <div className={'ck-card' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
        <div className="ck-head">
          <div>
            <div className="ck-teams">{mt.teams}</div>
            <div className="ck-meta">{mt.grp ? mt.grp + ' · ' : ''}{time}<small>{zone}</small></div>
          </div>
          <span className={'conf-pill ' + cpill(conf)}>{fav} {conf}%</span>
        </div>
        <div className="ck-mkt three">
          {outs.map((o, i) => (
            <Copyable key={i} className={'ck-out' + (o.label === fav ? ' fav' : '')} icon={false}
              copy={`${o.label}${o.label === 'Draw' ? '' : ' to win'} @ ${fmtOdds(o.am, fmt)} (model ${pc(o.p)}%)`}>
              <div className="ck-out-l">{o.label}</div>
              <div className="ck-out-o">{fmtOdds(o.am, fmt)}</div>
              <div className="ck-out-p">{pc(o.p)}%</div>
            </Copyable>
          ))}
        </div>
        <div className="ck-toggle">{open ? 'Hide' : 'Chances · goals · easy & value bets'} <span className="tog">▾</span></div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="ck-body" onClick={e => e.stopPropagation()}
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}>
              <KnockoutEngine a={a} c={c} mk={mk} fmt={fmt} />
              {lu && <Section title="Lineups"><Lineups lu={lu} teamA={a} teamB={c} /></Section>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="ck-sec"><div className="ck-sec-t">{title}</div>{children}</div>;
}

// Same Poisson/Dixon-Coles engine as the group-stage cards: 1X2 + goals
// markets, model easy bets and a value parlay (fair odds — no book market here).
function KnockoutEngine({ a, c, mk, fmt }) {
  const pc = x => Math.round(x * 100);
  const over = mk.over25 >= 0.5, btts = mk.btts >= 0.5;
  const favP = Math.max(mk.home, mk.away), fav = mk.home >= mk.away ? a : c;
  const oP = over ? mk.over25 : 1 - mk.over25, bP = btts ? mk.btts : 1 - mk.btts;
  const easy = [
    { c: 'Match winner', p: `${fav} to win`, cf: pc(favP), o: probToAm(favP) },
    { c: 'Goals', p: `${over ? 'Over' : 'Under'} 2.5 goals`, cf: pc(oP), o: probToAm(oP) },
    { c: 'BTTS', p: `Both teams to score · ${btts ? 'Yes' : 'No'}`, cf: pc(bP), o: probToAm(bP) },
  ];
  const goalLeg = oP >= bP
    ? { p: `${over ? 'Over' : 'Under'} 2.5 goals`, prob: oP, o: probToAm(oP) }
    : { p: `BTTS ${btts ? 'Yes' : 'No'}`, prob: bP, o: probToAm(bP) };
  const legs = [{ p: `${fav} to win`, prob: favP, o: probToAm(favP) }, goalLeg];
  const pProb = legs.reduce((s, l) => s * l.prob, 1);
  const pDec = legs.reduce((s, l) => s * (dec(l.o) || 1), 1);
  const hit = pc(pProb), ret = `put £10 returns £${(pDec * 10).toFixed(2)}`;

  return (
    <div className="ck-eng">
      <Section title="Chances of winning">
        <ConfBar label={a} p={pc(mk.home)} fill="f-hi" />
        <ConfBar label="Draw (90 min)" p={pc(mk.draw)} fill="f-md" delay={0.05} />
        <ConfBar label={c} p={pc(mk.away)} fill="f-hi" delay={0.1} />
      </Section>
      <Section title="Goals — model">
        <ConfBar label="Over 2.5 goals" p={pc(mk.over25)} fill="f-bl" />
        <ConfBar label="Both teams score" p={pc(mk.btts)} fill="f-pu" delay={0.06} />
        <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>Projected goals: <b style={{ color: 'var(--tx)' }}>{a} {mk.lh.toFixed(2)}</b> — <b style={{ color: 'var(--tx)' }}>{mk.la.toFixed(2)} {c}</b></div>
      </Section>
      <Section title="🎯 Easy bets">
        {easy.map((e, i) => (
          <Copyable key={i} className={'ebet' + (e.cf >= 60 ? ' star' : '')} icon={false} copy={`${e.p} @ ${fmtOdds(e.o, fmt)}`}>
            <div className="eb-l"><div className="eb-cat">{e.c}</div><div className="eb-pick">{e.p} <span className="copy-ico">⧉</span></div><div className="eb-odds">{fmtOdds(e.o, fmt)}</div></div>
            <span className={'eb-cf ' + ecls(e.cf)}>{e.cf}%</span>
          </Copyable>
        ))}
      </Section>
      <Section title="⚡ Value parlay">
        <div className="parlay">
          <div className="pl-hd"><span>⚡ Winner + goals</span></div>
          {legs.map((l, i) => (
            <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.o, fmt)}`}>
              <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.o, fmt)}</span>
            </Copyable>
          ))}
          <div className="pl-ret">Est. hit <span style={{ color: 'var(--ac)' }}>~{hit}%</span> · {ret}</div>
        </div>
      </Section>
      <div className="ref-box" style={{ marginTop: 2 }}>
        Opponent-adjusted Poisson / Dixon-Coles model (same engine as the group stage) — fair odds, no bookmaker margin. Draw is the 90-minute result. Estimates for entertainment, not guarantees.
      </div>
    </div>
  );
}
