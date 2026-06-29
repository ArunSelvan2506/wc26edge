import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DAYS, UPDATED } from '../data.js';
import { norm, markets } from '../lib/model.js';
import { probToAm, dec, buildParlays } from '../lib/sportEngine.js';
import { footballEngine } from '../lib/football.js';
import { fmtOdds } from '../lib/odds.js';
import { timeIn, dayLabelIn, zoneLabel } from '../lib/tz.js';
import { upcomingFixtures } from '../lib/completion.js';
import { lineupFor, squadFor } from '../lib/live.js';
import { cpill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar, SweepTimer } from './Bits.jsx';
import { useSweep } from '../lib/useSweep.js';
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
  const { now, nowMin, nextSweep } = useSweep();
  // Completed matches drop off; re-checked each minute (3-hour sweep cadence).
  const upcoming = useMemo(() => upcomingFixtures(now), [nowMin]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [filter, setFilter] = useState('R32');
  // Only show a knockout tie once BOTH sides are real resolved nations — until
  // the prior round is played a slot is a placeholder ("W75"), which would be
  // misleading (e.g. "Canada vs W75").
  const bothResolved = mt => {
    const [a, c] = (mt.teams || '').split(/\s+vs\s+/i);
    return a && c && rat && rat.has(a) && rat.has(c);
  };
  const blocks = upcoming
    .filter(b => stageCat(b.stage) === filter)
    .map(b => ({ ...b, matches: b.matches.filter(bothResolved) }))
    .filter(b => b.matches.length);

  return (
    <div>
      <div className="section-h">Upcoming fixtures · World Cup 2026</div>
      <div className="live-badge">
        <span className="live-dot" /> Updated {freshLabel(UPDATED)}
        <SweepTimer now={now} nextSweep={nextSweep} />
      </div>
      <div className="chips">
        {FILTERS.map(f => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="no-matches">No upcoming fixtures in this stage.</div>
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
              <KnockoutEngine rat={rat} a={a} c={c} fmt={fmt} lineup={lu} squads={{ a: squadFor(a), c: squadFor(c) }} />
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

// Full model/AI engine for every knockout tie: 1X2 + goals + foul/card/corner/
// shot props (from team strength & form), model easy bets, and safe + value
// parlays. Fair odds — no book market here.
function KnockoutEngine({ rat, a, c, fmt, lineup, squads }) {
  const pc = x => Math.round(x * 100);
  const eng = footballEngine(rat, a, c, lineup, squads);   // { mk, props, playerFouls, fav, dog, legs }
  const mk = eng.mk;
  const props = eng.props;
  const pf = eng.playerFouls;
  const ko = eng.ko, script = eng.script, radar = eng.radar;
  const fav = eng.fav.n, favP = eng.fav.p;
  const over = ko.over25 >= 0.5;
  const picks = [
    { c: 'Match winner', p: `${fav} to win`, cf: pc(favP), o: probToAm(favP) },
    { c: 'Goals', p: `${over ? 'Over' : 'Under'} 2.5 goals`, cf: pc(Math.max(ko.over25, 1 - ko.over25)), o: probToAm(Math.max(ko.over25, 1 - ko.over25)) },
    { c: 'Cards', p: `${props.cards.side} ${props.cards.line} cards`, cf: pc(props.cards.prob), o: props.cards.am },
    { c: 'Shots', p: `${props.sot.side} ${props.sot.line} shots on target`, cf: pc(props.sot.prob), o: props.sot.am },
  ];
  const { safe, value } = buildParlays(eng.legs);
  const vcls = v => (v === 'Bet' ? 'vd-bet' : v === 'Lean' ? 'vd-lean' : 'vd-pass');

  const propRow = (o, i) => (
    <Copyable key={i} className="prop-row" icon={false} copy={`${o.side} ${o.line} ${o.label} @ ${fmtOdds(o.am, fmt)}`}>
      <span className="prop-pick">{o.side} {o.line} {o.label} <span className="copy-ico">⧉</span></span>
      <span className="prop-meta"><span className={'prop-hits ' + ecls(pc(o.prob))}>{pc(o.prob)}/100</span><span className="prop-od">{fmtOdds(o.am, fmt)}</span></span>
    </Copyable>
  );
  const pfRow = (o, i) => (
    <Copyable key={i} className="prop-row" icon={false} copy={`${o.who} 1+ foul (Over 0.5) @ ${fmtOdds(o.am, fmt)}`}>
      <span className="prop-pick">{o.who} · 1+ foul <span className="copy-ico">⧉</span></span>
      <span className="prop-meta"><span className={'prop-hits ' + ecls(pc(o.prob))}>{o.hits}/10</span><span className="prop-od">{fmtOdds(o.am, fmt)}</span></span>
    </Copyable>
  );

  const tabs = [
    {
      id: 'script', label: '📋 Game script', body: (
        <>
          {script.lines.map((l, i) => <div key={i} className="gs-line">{l}</div>)}
          <div className="ck-sec-t" style={{ marginTop: 10 }}>Verdict by market</div>
          {script.markets.map((mm, i) => (
            <div key={i} className="gs-mkt">
              <div className="gs-mkt-l"><div className="gs-mkt-m">{mm.m}</div><div className="gs-mkt-p">{mm.pick} <small>· {mm.note}</small></div></div>
              <div className="gs-mkt-r"><span className={'eb-cf ' + ecls(mm.conf)}>{mm.conf}/100</span><span className={'vd ' + vcls(mm.verdict)}>{mm.verdict}</span></div>
            </div>
          ))}
          <div className="rec-note">Bet / Lean / Pass is an AI confidence read — never a guarantee.</div>
        </>
      ),
    },
    {
      id: 'upset', label: '🚨 Upset radar', body: (
        <>
          <div className={'upset-verdict ' + (radar.live ? 'live' : 'fair')}>
            {radar.live ? '🔥 Live upset spot' : '✓ Fair price'} · {radar.dog} upset {radar.upsetPct}/100
          </div>
          <div className="gs-line">{radar.verdict}</div>
          <div className="ck-sec-t" style={{ marginTop: 8 }}>Favourite vulnerability — {radar.fav}</div>
          {radar.favVuln.map((v, i) => <div key={i} className="gs-bullet">• {v}</div>)}
          <div className="ck-sec-t" style={{ marginTop: 8 }}>{radar.dog}'s path to the upset</div>
          <div className="gs-bullet">• {radar.dogPath}</div>
          <div className="ck-sec-t" style={{ marginTop: 8 }}>Style clash</div>
          <div className="gs-bullet">• {radar.clash}</div>
        </>
      ),
    },
    {
      id: 'chances', label: 'Chances', body: (
        <>
          <ConfBar label={a} p={pc(mk.home)} fill="f-hi" />
          <ConfBar label="Draw (90 min)" p={pc(mk.draw)} fill="f-md" delay={0.05} />
          <ConfBar label={c} p={pc(mk.away)} fill="f-hi" delay={0.1} />
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 6 }}>Draw is the 90-min result — extra-time / penalties risk <b style={{ color: 'var(--tx)' }}>{pc(ko.etRisk)}/100</b>.</div>
        </>
      ),
    },
    {
      id: 'goals', label: 'Goals', body: (
        <>
          <ConfBar label="Over 2.5 goals" p={pc(ko.over25)} fill="f-bl" />
          <ConfBar label="Both teams score" p={pc(ko.bttsYes)} fill="f-pu" delay={0.06} />
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>Projected goals · <b style={{ color: 'var(--tx)' }}>{a} {ko.la.toFixed(1)}</b> — <b style={{ color: 'var(--tx)' }}>{ko.lb.toFixed(1)} {c}</b></div>
        </>
      ),
    },
    {
      id: 'fouls', label: '🟨 Fouls', body: (
        <>{propRow(props.fouls, 0)}{propRow(props.cards, 1)}{propRow(props.corners, 2)}</>
      ),
    },
    {
      id: 'shots', label: '🎯 Shots', body: (
        <>{propRow(props.sot, 0)}{propRow(props.sotA, 1)}{propRow(props.sotC, 2)}</>
      ),
    },
    {
      id: 'pfouls', label: '👤 Player fouls', body: (
        <>
          <div className="pf-team">{a}</div>
          {pf.a.map((o, i) => pfRow(o, 'a' + i))}
          <div className="pf-team" style={{ marginTop: 8 }}>{c}</div>
          {pf.c.map((o, i) => pfRow(o, 'c' + i))}
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 7 }}>
            <b style={{ color: 'var(--tx)' }}>x/10</b> = how often he commits 1+ foul across his last 10. {
              pf.mode === 'confirmed' ? 'Confirmed starting XI.'
                : pf.mode === 'projected' ? 'Probable XI — firms up ~1h before kick-off.'
                : 'Names appear once the XI is published.'
            }</div>
        </>
      ),
    },
    {
      id: 'picks', label: '🎯 AI picks', body: (
        <>{picks.map((e, i) => (
          <Copyable key={i} className={'ebet' + (e.cf >= 60 ? ' star' : '')} icon={false} copy={`${e.p} @ ${fmtOdds(e.o, fmt)} · AI ${e.cf}/100`}>
            <div className="eb-l"><div className="eb-cat">{e.c}</div><div className="eb-pick">{e.p} <span className="copy-ico">⧉</span></div><div className="eb-odds">{fmtOdds(e.o, fmt)}</div></div>
            <span className={'eb-cf ' + ecls(e.cf)}>{e.cf}/100</span>
          </Copyable>
        ))}
          <div className="rec-note">Ranked by AI confidence (out of 100) — not guarantees. Knockout football is low-event and high-variance.</div>
        </>
      ),
    },
    {
      id: 'parlays', label: 'Multis', body: (
        <div className="parlay-grid">
          <KParlay title="🔵 High-confidence multi" sub="top AI-confidence legs" slip={safe} fmt={fmt} tone="safe" />
          <KParlay title="⚡ ACCA · high returns" sub="best long-odds multi" slip={value} fmt={fmt} tone="value" />
        </div>
      ),
    },
  ];
  const [tab, setTab] = useState('script');
  const active = tabs.find(t => t.id === tab) || tabs[0];

  return (
    <div className="ck-eng">
      <div className="eng-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab"
            className={'eng-tab' + (t.id === tab ? ' on' : '')}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="eng-pane">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
            {active.body}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="ref-box" style={{ marginTop: 2 }}>
Tight, cautious knockout ties that can go to extra time / penalties. Everything is <b>AI confidence out of 100</b> — never a guarantee, never a "safe" bet. Lineups unconfirmed until ~1h before kick-off. For entertainment — never stake more than you can afford to lose.
      </div>
    </div>
  );
}

function KParlay({ title, sub, slip, fmt, tone }) {
  if (!slip) return (
    <div className={'parlay ' + tone}><div className="pl-hd"><span>{title}</span></div><div className="pl-sub">{sub}</div><div className="pl-empty">No qualifying legs.</div></div>
  );
  const hit = Math.round(slip.prob * 100);
  const ret = `put £10 returns £${(slip.dec * 10).toFixed(2)}`;
  return (
    <div className={'parlay ' + tone}>
      <div className="pl-hd"><span>{title}</span><span className="pl-od">{slip.dec.toFixed(2)}x</span></div>
      <div className="pl-sub">{sub} · {slip.legs.length} legs</div>
      {slip.legs.map((l, i) => (
        <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.am, fmt)}`}>
          <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.am, fmt)}</span>
        </Copyable>
      ))}
      <div className="pl-meter"><span className="pl-meter-fill" style={{ width: hit + '%' }} /></div>
      <div className="pl-conf"><span>AI confidence <b style={{ color: tone === 'value' ? 'var(--ac3)' : 'var(--ac)' }}>{hit}/100</b></span><span>{ret}</span></div>
    </div>
  );
}
