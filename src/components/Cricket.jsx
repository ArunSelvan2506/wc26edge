import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CRICKET } from '../data.js';
import { fmtOdds } from '../lib/odds.js';
import { cricketMarket, cricketBets, cricketParlay, cricketForm, FORMAT_LABEL, fmtKey } from '../lib/cricket.js';
import { cpill, cfill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar } from './Bits.jsx';

const FORMATS = ['All', 'Test', 'ODI', 'T20I'];
const GENDERS = [['all', 'All'], ['men', "Men's"], ['women', "Women's"]];
const FMT_CLASS = { test: 'cf-test', odi: 'cf-odi', t20i: 'cf-t20' };
const gOf = m => (m.gender === 'women' ? 'women' : 'men');

export default function Cricket({ fmt }) {
  const blocks = CRICKET.blocks || [];
  const [filter, setFilter] = useState('All');
  const [gender, setGender] = useState('all');

  const view = useMemo(() => blocks.map(b => ({
    ...b,
    matches: b.matches.filter(m =>
      (filter === 'All' || FORMAT_LABEL[fmtKey(m.format)] === filter) &&
      (gender === 'all' || gOf(m) === gender)),
  })).filter(b => b.matches.length), [blocks, filter, gender]);

  return (
    <div>
      <div className="section-h">International cricket · match-winner odds</div>
      <div className="live-badge">
        <span className="live-dot" /> Model-derived fair odds · whole win market
      </div>
      <div className="chips">
        {GENDERS.map(([k, l]) => (
          <button key={k} className={'chip' + (gender === k ? ' active' : '')} onClick={() => setGender(k)}>{l}</button>
        ))}
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
  const [open, setOpen] = useState(false);
  const women = gOf(m) === 'women';
  const gender = women ? 'women' : 'men';
  const mk = cricketMarket(m.t1, m.t2, m.format, gender);
  const f = mk.format;
  const pc = x => Math.round(x * 100);
  const fav = mk.pA >= mk.pB ? m.t1 : m.t2;
  const conf = pc(Math.max(mk.pA, mk.pB));

  const outcomes = [
    { label: m.t1, p: mk.pA, odds: mk.oddsA },
    ...(f === 'test' ? [{ label: 'Draw', p: mk.pDraw, odds: mk.oddsDraw }] : []),
    { label: m.t2, p: mk.pB, odds: mk.oddsB },
  ];

  return (
    <motion.div className={'ck-card' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.2), ease: 'easeOut' }}>
      <div className="ck-head">
        <div>
          <div className="ck-teams">{m.teams}</div>
          <div className="ck-meta">
            <span className={'ck-fmt ' + (FMT_CLASS[f] || '')}>{FORMAT_LABEL[f]}</span>
            {women && <span className="ck-w">Women</span>}
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
      <div className="ck-toggle">{open ? 'Hide' : 'Form · chances · score · easy & value bets'} <span className="tog">▾</span></div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ck-body" onClick={e => e.stopPropagation()}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}>
            <CricketEngine m={m} fmt={fmt} gender={gender} mk={mk} f={f} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CricketEngine({ m, fmt, gender, mk, f }) {
  const pc = x => Math.round(x * 100);
  const { fav, sc, easy } = cricketBets(m);
  const parlay = cricketParlay(m);
  const f1 = cricketForm(m.t1, gender), f2 = cricketForm(m.t2, gender);

  return (
    <div className="ck-eng">
      {(f1 || f2) && (
        <Section title="Recent form">
          <FormRow team={m.t1} form={f1} />
          <FormRow team={m.t2} form={f2} />
        </Section>
      )}

      <Section title="Chances of winning">
        <ConfBar label={m.t1} p={pc(mk.pA)} fill="f-hi" />
        {f === 'test' && <ConfBar label="Draw" p={pc(mk.pDraw)} fill="f-md" delay={0.05} />}
        <ConfBar label={m.t2} p={pc(mk.pB)} fill="f-hi" delay={0.1} />
      </Section>

      {sc && (
        <Section title="Score predictor">
          <div className="ck-score">
            <span><b>{m.t1}</b> {sc.total1}</span>
            <span className="ck-score-sep">vs</span>
            <span>{sc.total2} <b>{m.t2}</b></span>
          </div>
          <div className="ck-score-meta">Projected match total ≈ <b>{sc.matchTotal}</b> runs · line {sc.line}</div>
          <div className="ck-ou">
            <Copyable className={'ck-out' + (sc.pOver >= sc.pUnder ? ' fav' : '')} icon={false}
              copy={`Over ${sc.line} match runs @ ${fmtOdds(sc.oddsOver, fmt)} (model ${pc(sc.pOver)}%)`}>
              <div className="ck-out-l">Over {sc.line}</div>
              <div className="ck-out-o">{fmtOdds(sc.oddsOver, fmt)}</div>
              <div className="ck-out-p">{pc(sc.pOver)}%</div>
            </Copyable>
            <Copyable className={'ck-out' + (sc.pUnder > sc.pOver ? ' fav' : '')} icon={false}
              copy={`Under ${sc.line} match runs @ ${fmtOdds(sc.oddsUnder, fmt)} (model ${pc(sc.pUnder)}%)`}>
              <div className="ck-out-l">Under {sc.line}</div>
              <div className="ck-out-o">{fmtOdds(sc.oddsUnder, fmt)}</div>
              <div className="ck-out-p">{pc(sc.pUnder)}%</div>
            </Copyable>
          </div>
        </Section>
      )}

      <Section title="🎯 Easy bets">
        {easy.map((e, i) => (
          <Copyable key={i} className={'ebet' + (e.star ? ' star' : '')} icon={false} copy={`${e.p} @ ${fmtOdds(e.o, fmt)}`}>
            <div className="eb-l">
              <div className="eb-cat">{e.c}</div>
              <div className="eb-pick">{e.p} <span className="copy-ico">⧉</span></div>
              <div className="eb-odds">{fmtOdds(e.o, fmt)}</div>
            </div>
            <span className={'eb-cf ' + ecls(e.cf)}>{e.cf}%</span>
          </Copyable>
        ))}
      </Section>

      {parlay.legs.length > 1 && (
        <Section title="⚡ Value parlay">
          <ParlaySlip parlay={parlay} fmt={fmt} />
        </Section>
      )}

      <div className="ref-box" style={{ marginTop: 2 }}>
        Win % from format/gender strength ratings (logistic). Score predictor estimates innings totals from the rating gap and matchup quality; the runs line is a model par. Odds are fair (no margin). Estimates for entertainment — not guarantees.
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="ck-sec">
      <div className="ck-sec-t">{title}</div>
      {children}
    </div>
  );
}

function FormRow({ team, form }) {
  return (
    <div className="ck-form">
      <span className="ck-form-t">{team}</span>
      <span className="ck-form-d">
        {form
          ? form.map((r, i) => <span key={i} className={'fdot f-' + r.toLowerCase()}>{r}</span>)
          : <span className="ck-form-na">no recent data</span>}
      </span>
    </div>
  );
}

function ParlaySlip({ parlay, fmt }) {
  const hit = Math.round(parlay.prob * 100);
  const ret = parlay.dec ? `+${parlay.dec.toFixed(2)}x · $10→$${(parlay.dec * 10).toFixed(0)}` : '—';
  const copy = 'Value parlay\n' + parlay.legs.map((l, i) => `${i + 1}. ${l.p} @ ${fmtOdds(l.o, fmt)}`).join('\n') + `\nEst. hit ~${hit}% · return ${ret}`;
  return (
    <div className="parlay">
      <div className="pl-hd">
        <span>⚡ Winner + total runs</span>
        <Copyable copy={copy} icon={false} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(45,200,160,.12)', border: '1px solid rgba(45,200,160,.35)', color: 'var(--ac)' }}>⧉</Copyable>
      </div>
      {parlay.legs.map((l, i) => (
        <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.o, fmt)}`}>
          <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.o, fmt)}</span><span className="copy-ico">⧉</span>
        </Copyable>
      ))}
      <div className="pl-ret">Est. combined hit <span style={{ color: 'var(--ac)' }}>~{hit}%</span> · return <span>{ret}</span></div>
    </div>
  );
}
