import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtOdds } from '../lib/odds.js';
import { TENNIS } from '../data/sports.js';
import { tennisMatch, tennisHits, tennisParlays, injInfo } from '../lib/tennis.js';
import { dayKeyIn, dayLabelIn, timeIn, zoneLabel } from '../lib/tz.js';
import { cpill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar } from './Bits.jsx';

const pc = x => Math.round(x * 100);
const REFRESH_MS = 3 * 3600e3;          // completed-game sweep cadence

// "2d 3h" / "5h 12m" / "48m" / "12m 04s"
function countdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return `${m}m ${String(ss).padStart(2, '0')}s`;
}
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// Model every match once (markets/legs are time-independent; status is live).
function buildTennis(cfg) {
  return cfg.events.map(ev => ({
    ...ev,
    matches: ev.matches.map(m => ({ m: { ...m, utc: m.utc || ev.utc, series: ev.series }, mk: tennisMatch(cfg, { ...m, utc: m.utc || ev.utc, series: ev.series }, 0) })),
  }));
}

export default function Tennis({ fmt, tz = 'Asia/Kolkata', dateSel = 'all' }) {
  const cfg = TENNIS;
  const allEvents = useMemo(() => buildTennis(cfg), [cfg]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const nextSweep = Math.ceil(now / REFRESH_MS) * REFRESH_MS;   // next 3h boundary

  // Drop completed matches; keep upcoming/live. Then apply the date filter.
  const events = allEvents.map(ev => {
    const matches = ev.matches.filter(x => recompute(x.m.utc, x.mk.bestOf, now).state !== 'done'
      && (dateSel === 'all' || dayKeyIn(x.m.utc, tz) === dateSel));
    return { ...ev, matches };
  }).filter(ev => ev.matches.length);

  // Hits & parlays from only the still-live/upcoming board (completed games gone).
  const liveLegs = allEvents.flatMap(e => e.matches)
    .filter(x => recompute(x.m.utc, x.mk.bestOf, now).state !== 'done')
    .flatMap(x => x.mk.legs);
  const hits = tennisHits(liveLegs);
  const parlays = tennisParlays(liveLegs);
  const liveCount = allEvents.flatMap(e => e.matches).filter(x => recompute(x.m.utc, x.mk.bestOf, now).state === 'live').length;

  return (
    <div>
      <div className="section-h">{cfg.label} · live model & bets</div>

      <div className="tn-timer">
        <div className="tn-timer-l">
          <span className="live-dot" /> {liveCount > 0 ? `${liveCount} live now · ` : ''}auto-removes completed games
        </div>
        <div className="tn-timer-r">↻ next sweep in <b>{clock(nextSweep - now)}</b></div>
      </div>
      <div className="live-badge">🎾 Elo + surface + form + injury model · in-form & injury-aware picks · returns in £</div>

      {hits.length > 0 && (
        <div className="rec-box">
          <div className="rec-h">💸 AI recommended hits <span className="rec-sub">in-form · fit · model edge</span></div>
          {hits.map((h, i) => (
            <Copyable key={i} className="rec-row" icon={false} copy={`${h.p} @ ${fmtOdds(h.am, fmt)} · put £${h.stake} returns £${h.ret}`}>
              <div className="rec-l">
                <div className="rec-pick">{h.p}{injBadge(h.inj)}</div>
                <div className="rec-tag">{h.tag} · {fmtOdds(h.am, fmt)}{h.why ? ' · ' + h.why : ''}</div>
              </div>
              <div className="rec-r">
                <span className={'eb-cf ' + ecls(pc(h.prob))}>{pc(h.prob)}%</span>
                <span className="rec-stake">£{h.stake} → £{h.ret}</span>
              </div>
            </Copyable>
          ))}
          <div className="rec-note">In-form players up-weighted, injured players down-weighted. Example returns include stake — entertainment only.</div>
        </div>
      )}

      <div className="parlay-grid">
        <ParlayCard title="🟢 Safe parlay" sub="legs under 1.75 · fit & in-form" slip={parlays.safe} fmt={fmt} tone="safe" />
        <ParlayCard title="⚡ Value parlay" sub="legs over 4.0 · in-form longshots" slip={parlays.value} fmt={fmt} tone="value" />
      </div>

      {events.length === 0 && <div className="empty-note">All listed matches have completed — the next slate loads on the 3-hour sweep.</div>}

      {events.map((ev, ei) => (
        <motion.div key={ei} className="fix-block"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}>
          <div className="fix-block-hdr">
            <div className="fix-date">{dayLabelIn(ev.matches[0].m.utc, tz)}</div>
            <span className="fix-stage fs-group">{ev.series}</span>
          </div>
          {ev.matches.map((x, i) => <MatchupCard key={i} cfg={cfg} x={x} fmt={fmt} tz={tz} now={now} index={i} />)}
        </motion.div>
      ))}

      <div className="ref-box" style={{ marginTop: 4 }}>
        Win % = surface-adjusted Elo (logistic) tuned by recent form and injuries; sets, total-games and aces are model-derived. No live tennis results feed exists for free, so fixtures are a curated upcoming slate and a match auto-clears the board once its expected duration elapses. Fair odds, no margin. Entertainment only.
      </div>
    </div>
  );
}

function recompute(utc, bestOf, now) {
  const t = typeof utc === 'number' ? utc : Date.parse(utc);
  const dur = (bestOf === 5 ? 3.6 : 2.2) * 3600e3;
  if (!isFinite(t)) return { state: 'upcoming', startsIn: 0 };
  if (now < t) return { state: 'upcoming', startsIn: t - now };
  if (now < t + dur) return { state: 'live', startsIn: 0 };
  return { state: 'done', startsIn: 0 };
}

function injBadge(inj) {
  const i = injInfo(inj);
  if (i.risk === 'none') return null;
  const cls = i.risk === 'out' || i.risk === 'high' ? 'inj-out' : 'inj-min';
  return <span className={'inj-flag sm ' + cls}>⚕ {inj}</span>;
}

function MatchupCard({ cfg, x, fmt, tz, now, index }) {
  const { m, mk } = x;
  const [open, setOpen] = useState(false);
  const st = recompute(m.utc, mk.bestOf, now);
  const conf = pc(Math.max(mk.pA, mk.pB));
  const A = cfg.roster[m.a] || {}, B = cfg.roster[m.b] || {};
  const aces = mk.legs.filter(l => l.kind === 'prop');
  const sets = mk.legs.filter(l => l.kind === 'sets' || l.kind === 'games');

  return (
    <motion.div className={'ck-card' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2), ease: 'easeOut' }}>
      <div className="ck-head">
        <div>
          <div className="ck-teams">{m.a} <span className="vs">vs</span> {m.b}</div>
          <div className="ck-meta">{m.label} · {timeIn(m.utc, tz)}<small>{zoneLabel(tz)}</small> · best of {mk.bestOf}</div>
        </div>
        {st.state === 'live'
          ? <span className="st-pill st-live"><span className="live-dot" /> LIVE</span>
          : <span className="st-pill st-soon">in {countdown(st.startsIn)}</span>}
      </div>
      <div className="ck-mkt">
        <Copyable className={'ck-out' + (mk.pA >= mk.pB ? ' fav' : '')} icon={false} copy={`${m.a} to win @ ${fmtOdds(mk.amA, fmt)} (${pc(mk.pA)}%)`}>
          <div className="ck-out-l">{m.a}{injBadge(A.inj)}</div><div className="ck-out-o">{fmtOdds(mk.amA, fmt)}</div><div className="ck-out-p">{pc(mk.pA)}%</div>
        </Copyable>
        <Copyable className={'ck-out' + (mk.pB > mk.pA ? ' fav' : '')} icon={false} copy={`${m.b} to win @ ${fmtOdds(mk.amB, fmt)} (${pc(mk.pB)}%)`}>
          <div className="ck-out-l">{m.b}{injBadge(B.inj)}</div><div className="ck-out-o">{fmtOdds(mk.amB, fmt)}</div><div className="ck-out-p">{pc(mk.pB)}%</div>
        </Copyable>
      </div>
      <div className="ck-toggle">{open ? 'Hide' : 'Form · AI read · sets · games · aces'} <span className="tog">▾</span></div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ck-body" onClick={e => e.stopPropagation()}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }} style={{ overflow: 'hidden' }}>
            <div className="ck-eng">
              <div className="ai-read">
                <span className="ai-tag">🤖 AI read</span>
                <b>{mk.fav.name}</b> favoured {conf}% on {mk.surface} — {mk.favWhy}.
                {(injInfo(A.inj).risk !== 'none' || injInfo(B.inj).risk !== 'none') && ' Injury factored into the model edge.'}
              </div>
              <Section title="Recent form">
                <FormRow name={m.a} form={A.form} inj={A.inj} />
                <FormRow name={m.b} form={B.form} inj={B.inj} />
              </Section>
              <Section title="Chances of winning">
                <ConfBar label={m.a} p={pc(mk.pA)} fill="f-hi" />
                <ConfBar label={m.b} p={pc(mk.pB)} fill="f-hi" delay={0.08} />
              </Section>
              <Section title="Sets & games (model)">
                {sets.map((l, i) => <PropRow key={i} l={l} fmt={fmt} />)}
              </Section>
              {aces.length > 0 && (
                <Section title="🎾 Aces · last-10 hits">
                  {aces.map((l, i) => <PropRow key={i} l={l} fmt={fmt} />)}
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Section({ title, children }) {
  return <div className="ck-sec"><div className="ck-sec-t">{title}</div>{children}</div>;
}
function FormRow({ name, form, inj }) {
  return (
    <div className="ck-form">
      <span className="ck-form-t">{name}{injBadge(inj)}</span>
      <span className="ck-form-d">
        {form && form.length
          ? form.map((r, i) => <span key={i} className={'fdot f-' + (/w/i.test(r) ? 'w' : /l/i.test(r) ? 'l' : 'n')}>{r}</span>)
          : <span className="ck-form-na">no recent data</span>}
      </span>
    </div>
  );
}
function PropRow({ l, fmt }) {
  return (
    <Copyable className="prop-row" icon={false} copy={`${l.p} @ ${fmtOdds(l.am, fmt)}`}>
      <span className="prop-pick">{l.p} <span className="copy-ico">⧉</span></span>
      <span className="prop-meta">
        {l.last10 != null ? <span className={'prop-hits ' + ecls(pc(l.prob))}>{l.last10}/10</span> : <span className="prop-hits">{pc(l.prob)}%</span>}
        <span className="prop-od">{fmtOdds(l.am, fmt)}</span>
      </span>
    </Copyable>
  );
}
function ParlayCard({ title, sub, slip, fmt, tone }) {
  if (!slip) return (
    <div className={'parlay ' + tone}><div className="pl-hd"><span>{title}</span></div><div className="pl-sub">{sub}</div><div className="pl-empty">No qualifying legs.</div></div>
  );
  const hit = Math.round(slip.prob * 100);
  const ret = `put £10 returns £${(slip.dec * 10).toFixed(2)}`;
  return (
    <div className={'parlay ' + tone}>
      <div className="pl-hd"><span>{title}</span></div>
      <div className="pl-sub">{sub}</div>
      {slip.legs.map((l, i) => (
        <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.am, fmt)}`}>
          <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.am, fmt)}</span>
        </Copyable>
      ))}
      <div className="pl-ret">Est. hit <span style={{ color: tone === 'value' ? 'var(--ac3)' : 'var(--ac)' }}>~{hit}%</span> · {ret}</div>
    </div>
  );
}
