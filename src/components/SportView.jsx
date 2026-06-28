import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtOdds } from '../lib/odds.js';
import { SPORT_CFG } from '../data/sports.js';
import { h2hMarket, raceMarket, buildParlays, recommendedHits } from '../lib/sportEngine.js';
import { dayKeyIn, dayLabelIn } from '../lib/tz.js';
import { cpill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar } from './Bits.jsx';

const pc = x => Math.round(x * 100);

function buildAll(cfg) {
  const events = cfg.events.map(ev => {
    if (cfg.kind === 'race') {
      const race = raceMarket(cfg, ev);
      return { ...ev, race, legs: race.legs };
    }
    const matches = ev.matches.map(m => ({ m, mk: h2hMarket(cfg, m) }));
    return { ...ev, matches, legs: matches.flatMap(x => x.mk.legs) };
  });
  const allLegs = events.flatMap(e => e.legs);
  return { events, hits: recommendedHits(allLegs), parlays: buildParlays(allLegs) };
}

export default function SportView({ sportId, fmt, tz = 'Asia/Kolkata', dateSel = 'all' }) {
  const cfg = SPORT_CFG[sportId];
  const { events: allEvents, hits, parlays } = useMemo(() => buildAll(cfg), [cfg]);
  // Race events ignore the date filter; H2H events filter by day in the chosen tz.
  const events = allEvents.filter(ev =>
    cfg.kind === 'race' || dateSel === 'all' ||
    (ev.utc != null ? dayKeyIn(ev.utc, tz) === dateSel : 'd:' + ev.date === dateSel));

  return (
    <div>
      <div className="section-h">{cfg.label} · model picks & bets</div>
      <div className="live-badge"><span className="live-dot" /> AI-curated form · model-fair odds · example returns in £</div>

      {hits.length > 0 && (
        <div className="rec-box">
          <div className="rec-h">💸 Recommended hits</div>
          {hits.map((h, i) => (
            <Copyable key={i} className="rec-row" icon={false} copy={`${h.p} @ ${fmtOdds(h.am, fmt)} · put £${h.stake} returns £${h.ret}`}>
              <div className="rec-l">
                <div className="rec-pick">{h.p}</div>
                <div className="rec-tag">{h.tag} · {fmtOdds(h.am, fmt)}</div>
              </div>
              <div className="rec-r">
                <span className={'eb-cf ' + ecls(pc(h.prob))}>{pc(h.prob)}%</span>
                <span className="rec-stake">£{h.stake} → £{h.ret}</span>
              </div>
            </Copyable>
          ))}
          <div className="rec-note">Example returns include stake — entertainment only, bet responsibly.</div>
        </div>
      )}

      <div className="parlay-grid">
        <ParlayCard title="🟢 Safe parlay" sub="short-priced favourites" slip={parlays.safe} fmt={fmt} tone="safe" />
        <ParlayCard title="⚡ ACCA · high returns" sub="best long-odds multi" slip={parlays.value} fmt={fmt} tone="value" />
      </div>

      {events.map((ev, ei) => (
        <motion.div key={ei} className="fix-block"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}>
          <div className="fix-block-hdr">
            <div className="fix-date">{ev.utc != null ? dayLabelIn(ev.utc, tz) : ev.date}</div>
            <span className="fix-stage fs-group">{ev.series}</span>
          </div>
          {cfg.kind === 'race'
            ? <RaceCard cfg={cfg} ev={ev} fmt={fmt} />
            : ev.matches.map((x, i) => <MatchupCard key={i} cfg={cfg} m={x.m} mk={x.mk} fmt={fmt} index={i} />)}
        </motion.div>
      ))}

      <div className="ref-box" style={{ marginTop: 4 }}>
        Win % from curated strength ratings (logistic / softmax). Form, player props (robust last-10 hits) and injuries are AI-curated illustrative data — no live feed. Odds are fair (no margin). Estimates for entertainment — not guarantees.
      </div>
    </div>
  );
}

/* ── Head-to-head card (Tennis / Basketball) ── */
function MatchupCard({ cfg, m, mk, fmt, index }) {
  const [open, setOpen] = useState(false);
  const conf = pc(Math.max(mk.pA, mk.pB));
  const injA = cfg.roster[m.a]?.inj, injB = cfg.roster[m.b]?.inj;
  return (
    <motion.div className={'ck-card' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2), ease: 'easeOut' }}>
      <div className="ck-head">
        <div>
          <div className="ck-teams">{m.a} <span className="vs">vs</span> {m.b}</div>
          <div className="ck-meta">{m.label || cfg.label}{(injA || injB) && <span className="inj-flag">⚕ injury</span>}</div>
        </div>
        <span className={'conf-pill ' + cpill(conf)}>{mk.fav.name.split(' ').slice(-1)[0]} {conf}%</span>
      </div>
      <div className="ck-mkt">
        <Copyable className={'ck-out' + (mk.pA >= mk.pB ? ' fav' : '')} icon={false} copy={`${m.a} to win @ ${fmtOdds(mk.amA, fmt)} (${pc(mk.pA)}%)`}>
          <div className="ck-out-l">{m.a}</div><div className="ck-out-o">{fmtOdds(mk.amA, fmt)}</div><div className="ck-out-p">{pc(mk.pA)}%</div>
        </Copyable>
        <Copyable className={'ck-out' + (mk.pB > mk.pA ? ' fav' : '')} icon={false} copy={`${m.b} to win @ ${fmtOdds(mk.amB, fmt)} (${pc(mk.pB)}%)`}>
          <div className="ck-out-l">{m.b}</div><div className="ck-out-o">{fmtOdds(mk.amB, fmt)}</div><div className="ck-out-p">{pc(mk.pB)}%</div>
        </Copyable>
      </div>
      <div className="ck-toggle">{open ? 'Hide' : 'Form · props · injuries'} <span className="tog">▾</span></div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ck-body" onClick={e => e.stopPropagation()}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }} style={{ overflow: 'hidden' }}>
            <div className="ck-eng">
              <Section title="Recent form (AI-curated)">
                <FormRow name={m.a} form={cfg.roster[m.a]?.form} inj={injA} />
                <FormRow name={m.b} form={cfg.roster[m.b]?.form} inj={injB} />
              </Section>
              <Section title="Chances of winning">
                <ConfBar label={m.a} p={pc(mk.pA)} fill="f-hi" />
                <ConfBar label={m.b} p={pc(mk.pB)} fill="f-hi" delay={0.08} />
              </Section>
              <PropsSection legs={mk.legs.filter(l => l.kind === 'prop' || l.kind === 'total')} fmt={fmt} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Race card (F1) ── */
function RaceCard({ cfg, ev, fmt }) {
  const [open, setOpen] = useState(true);
  const { rows, legs } = ev.race;
  return (
    <div className="ck-card open">
      <div className="ck-head">
        <div><div className="ck-teams">Race winner & podium</div><div className="ck-meta">{ev.field.length} drivers · model softmax</div></div>
        <button type="button" className="ck-mini" onClick={() => setOpen(o => !o)}>{open ? 'Hide grid' : 'Show grid'}</button>
      </div>
      <div className="f1-rows">
        {rows.map((d, i) => (
          <Copyable key={d.name} className={'f1-row' + (i === 0 ? ' lead' : '')} icon={false}
            copy={`${d.name} to win @ ${fmtOdds(d.amWin, fmt)} (${pc(d.pWin)}%)`}>
            <span className="f1-pos">{i + 1}</span>
            <span className="f1-name">{d.name}<small>{d.team}{d.pts != null ? ` · ${d.pts} pts` : ''}</small></span>
            <span className="f1-pct">{pc(d.pWin)}%<small>win</small></span>
            <span className="f1-pct">{pc(d.pPodium)}%<small>podium</small></span>
            <span className="f1-od">{fmtOdds(d.amWin, fmt)}</span>
          </Copyable>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ck-body"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }} style={{ overflow: 'hidden' }}>
            <div className="ck-eng">
              <Section title="Recent form (last 5 finishes)">
                {rows.slice(0, 6).map(d => <FormRow key={d.name} name={d.name} form={cfg.drivers[d.name]?.form} inj={cfg.drivers[d.name]?.inj} />)}
              </Section>
              <PropsSection legs={legs.filter(l => l.kind === 'prop')} fmt={fmt} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── shared bits ── */
function Section({ title, children }) {
  return <div className="ck-sec"><div className="ck-sec-t">{title}</div>{children}</div>;
}
function FormRow({ name, form, inj }) {
  const cls = r => {
    if (/^\d+$/.test(r)) return +r <= 3 ? 'f-w' : +r <= 8 ? 'f-d' : 'f-l';   // finish position
    return /^[wldn]$/i.test(r) ? 'f-' + r.toLowerCase() : 'f-n';              // W/L/D/N or DNF
  };
  return (
    <div className="ck-form">
      <span className="ck-form-t">{name}{inj && <span className="inj-flag sm">⚕ {inj}</span>}</span>
      <span className="ck-form-d">
        {form && form.length
          ? form.map((r, i) => <span key={i} className={'fdot ' + cls(r)}>{r}</span>)
          : <span className="ck-form-na">no recent data</span>}
      </span>
    </div>
  );
}
function PropsSection({ legs, fmt }) {
  if (!legs || !legs.length) return null;
  return (
    <Section title="🎯 Player props · robust last-10 hits">
      {legs.map((l, i) => (
        <Copyable key={i} className="prop-row" icon={false} copy={`${l.p} @ ${fmtOdds(l.am, fmt)}`}>
          <span className="prop-pick">{l.p} <span className="copy-ico">⧉</span></span>
          <span className="prop-meta">
            {l.last10 != null && <span className="prop-hits">{l.last10}/10</span>}
            <span className="prop-od">{fmtOdds(l.am, fmt)}</span>
          </span>
        </Copyable>
      ))}
    </Section>
  );
}
function ParlayCard({ title, sub, slip, fmt, tone }) {
  if (!slip) return (
    <div className={'parlay ' + tone}>
      <div className="pl-hd"><span>{title}</span></div>
      <div className="pl-sub">{sub}</div>
      <div className="pl-empty">No qualifying legs today.</div>
    </div>
  );
  const hit = Math.round(slip.prob * 100);
  const ret = `put £10 returns £${(slip.dec * 10).toFixed(2)}`;
  const copy = `${title}\n` + slip.legs.map((l, i) => `${i + 1}. ${l.p} @ ${fmtOdds(l.am, fmt)}`).join('\n') + `\nConfidence ~${hit}% · ${ret}`;
  return (
    <div className={'parlay ' + tone}>
      <div className="pl-hd">
        <span>{title}</span>
        <span className="pl-od">{slip.dec.toFixed(2)}x</span>
        <Copyable copy={copy} icon={false} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(45,200,160,.12)', border: '1px solid rgba(45,200,160,.35)', color: 'var(--ac)' }}>⧉</Copyable>
      </div>
      <div className="pl-sub">{sub} · {slip.legs.length} legs</div>
      {slip.legs.map((l, i) => (
        <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.am, fmt)}`}>
          <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.am, fmt)}</span>
        </Copyable>
      ))}
      <div className="pl-meter"><span className="pl-meter-fill" style={{ width: hit + '%' }} /></div>
      <div className="pl-conf"><span>Confidence <b style={{ color: tone === 'value' ? 'var(--ac3)' : 'var(--ac)' }}>~{hit}%</b></span><span>{ret}</span></div>
    </div>
  );
}
