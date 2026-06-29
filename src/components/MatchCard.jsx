import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtOdds } from '../lib/odds.js';
import { buildParlay } from '../lib/parlay.js';
import { markets, amToDec, devig, ev, kelly } from '../lib/model.js';
import { OG_STATS } from '../data.js';
import { lineupFor } from '../lib/live.js';
import { cc, cfill, cpill, ecls } from '../lib/ui.js';
import { Copyable, ConfBar } from './Bits.jsx';
import { Lineups } from './Lineups.jsx';

const BASE_TABS = [
  { id: 'result', label: 'Result' },
  { id: 'fouls', label: 'Fouls' },
  { id: 'shots', label: 'Shots' },
  { id: 'easy', label: 'Easy bets' },
  { id: 'model', label: '📊 Model' },
  { id: 'parlay', label: '⚡ Parlay' },
];

export default function MatchCard({ m, fmt, rat, index = 0 }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('result');
  const tag = m.tag === 'top' ? 'b-top' : m.tag === 'upset' ? 'b-upset' : 'b-info';
  const lu = lineupFor(m.hT, m.aT);
  const TABS = lu ? [...BASE_TABS, { id: 'lineups', label: '👥 Lineups' }] : BASE_TABS;

  return (
    <motion.div className={'mc' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25), ease: 'easeOut' }}>
      <div className="mc-head">
        <div className="mc-r1">
          <div>
            <div className="mc-teams" dangerouslySetInnerHTML={{ __html: m.teams + (m.live ? ' <span style="font-size:10px;color:var(--red);font-family:var(--mono)"> ● LIVE</span>' : '') }} />
            <div className="mc-meta">{m.group} · {m.venue} · {m.time}</div>
            <ModelPick m={m} rat={rat} />
          </div>
          <span className={'badge ' + tag}>{m.tl}</span>
        </div>
        <div className="mc-r2">
          <div className="odds-row">
            <Odd l="Home" v={fmtOdds(m.odds.h, fmt)} hi />
            <Odd l="Draw" v={fmtOdds(m.odds.d, fmt)} />
            <Odd l="Away" v={fmtOdds(m.odds.a, fmt)} />
            <Odd l="O/U" v={m.odds.ou} />
          </div>
          <span className={'conf-pill ' + cpill(m.conf)}>{m.conf}% conf</span>
          <span className="up-pill">⚡ {m.upset}% upset</span>
          <span className="tog">▾</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="mc-body" onClick={e => e.stopPropagation()}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}>
            <div className="tabs">
              {TABS.map(t => (
                <button key={t.id} className={'tab-btn' + (tab === t.id ? ' active' : '')}
                  onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>
              <Pane tab={tab} m={m} fmt={fmt} rat={rat} lu={lu} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Odd({ l, v, hi }) {
  return <div className="odd"><div className="odd-l">{l}</div><div className={'odd-v' + (hi ? ' hi' : '')}>{v}</div></div>;
}

// At-a-glance model prediction shown on the (collapsed) card.
function ModelPick({ m, rat }) {
  if (!rat || (!rat.has(m.hT) && !rat.has(m.aT))) return null;
  const mk = markets(rat, m.hT, m.aT);
  const pc = x => Math.round(x * 100);
  const [pick, p] = [[m.hT, mk.home], ['Draw', mk.draw], [m.aT, mk.away]].sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="model-pick">
      <span className="mp-tag">📊 AI</span> <b>{pick}</b> {pc(p)}/100 · O2.5 {pc(mk.over25)}/100 · BTTS {pc(mk.btts)}/100
    </div>
  );
}

function Pane({ tab, m, fmt, rat, lu }) {
  if (tab === 'result') return <ResultTab m={m} fmt={fmt} />;
  if (tab === 'fouls') return <FoulsTab m={m} fmt={fmt} />;
  if (tab === 'shots') return <ShotsTab m={m} fmt={fmt} />;
  if (tab === 'easy') return <EasyTab m={m} fmt={fmt} />;
  if (tab === 'model') return <ModelTab m={m} fmt={fmt} rat={rat} />;
  if (tab === 'parlay') return <ParlayTab m={m} fmt={fmt} rat={rat} />;
  if (tab === 'lineups') return lu ? <Lineups lu={lu} teamA={m.hT} teamB={m.aT} /> : null;
  return null;
}

/* ── Result ── */
function ResultTab({ m, fmt }) {
  const oddOf = t => (t === m.hT ? m.odds.h : t === m.aT ? m.odds.a : m.odds.d);
  return (
    <div className="pred-grid">
      <div className="psec">
        <div className="psec-t">Result prediction</div>
        <div className="rboxes">
          <Copyable className={'rbox' + (m.winner === m.hT ? ' win' : '')} icon={false} copy={`${m.hT} to win @ ${fmtOdds(m.odds.h, fmt)}`}>
            <div className="rb-t">{m.hT}</div><div className="rb-o">{fmtOdds(m.odds.h, fmt)}</div><div className="rb-p">{m.wP}%</div>
          </Copyable>
          <Copyable className="rbox" icon={false} copy={`${m.hT} vs ${m.aT} — Draw @ ${fmtOdds(m.odds.d, fmt)}`}>
            <div className="rb-t">Draw</div><div className="rb-o">{fmtOdds(m.odds.d, fmt)}</div><div className="rb-p">{m.dP}%</div>
          </Copyable>
          <Copyable className={'rbox' + (m.winner === m.aT ? ' win' : '')} icon={false} copy={`${m.aT} to win @ ${fmtOdds(m.odds.a, fmt)}`}>
            <div className="rb-t">{m.aT}</div><div className="rb-o">{fmtOdds(m.odds.a, fmt)}</div><div className="rb-p">{m.aP}%</div>
          </Copyable>
        </div>
        <Copyable className="win-lbl" icon={false} copy={`${m.winner} to win @ ${fmtOdds(oddOf(m.winner), fmt)} (${m.conf}% confidence)`}>
          ▶ {m.winner} · {m.conf}% confidence
        </Copyable>
      </div>
      <div className="psec">
        <div className="psec-t">Confidence breakdown</div>
        {(m.cbars || []).map((r, i) => <ConfBar key={i} label={r.l} p={r.p} fill={r.f} delay={i * 0.05} />)}
      </div>
      <BaselineBlock m={m} />
    </div>
  );
}

function matchOver25(m) {
  const c = (m.cbars || []).find(r => /over\s*2\.5/i.test(r.l || '')); if (c) return c.p;
  const e = (m.easy || []).find(x => /over\s*2\.5/i.test(x.p || '')); if (e) return e.cf;
  return null;
}
function BaselineBlock({ m }) {
  const b = OG_STATS.baseline, o = matchOver25(m);
  let edge = null;
  if (o != null) {
    const d = o - b.over25Pct;
    const col = d >= 8 ? 'var(--ac)' : d <= -8 ? 'var(--red)' : 'var(--mu)';
    const lean = d >= 8 ? 'lean OVER' : d <= -8 ? 'lean UNDER' : 'in line';
    edge = <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--b1)' }}>
      Over 2.5 goals: <b style={{ color: 'var(--tx)' }}>{o}/100</b> → <b style={{ color: col }}>{lean}</b>
    </div>;
  }
  const Cell = ({ l, v }) => <div style={{ textAlign: 'center' }}><div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mu)' }}>{l}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--ac2)', marginTop: 2 }}>{v}</div></div>;
  return (
    <div style={{ gridColumn: '1/-1', background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 9, padding: 11 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 9 }}>
        📊 WC historical baseline <span style={{ color: 'var(--dm)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· openfootball · {OG_STATS.allTime.matches} matches · {b.basis}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        <Cell l="Goals/g" v={b.goalsPerGame} /><Cell l="Over 2.5" v={b.over25Pct + '%'} /><Cell l="BTTS" v={b.bttsPct + '%'} /><Cell l="GS Draw" v={b.drawPct + '%'} />
      </div>
      {edge}
    </div>
  );
}

/* ── Fouls (curated) ── */
function FoulsTab({ m, fmt }) {
  if (!m.fouls || !m.fouls.length) return <Empty>No featured foul props</Empty>;
  return m.fouls.map((f, i) => {
    const drawn = /drawn|won|fouled/i.test((f.bets && f.bets[0] && f.bets[0].l) || '');
    const dotLbl = drawn ? 'Last 10 — drew 1+ foul (was fouled)' : 'Last 10 — committed 1+ foul';
    const cbLbl = drawn ? 'Fouls drawn confidence' : 'Fouls committed confidence';
    return (
      <div key={i} className={'fpl' + (f.hot ? ' hot' : '')}>
        <div className="fp-top">
          <div>
            <div className="fp-nm">{f.nm} <span className={'mkt-tag ' + (drawn ? 'mkt-drawn' : 'mkt-commit')}>{drawn ? 'DRAWS FOULS' : 'COMMITS FOULS'}</span></div>
            <div className="fp-cl">{f.cl}</div>
          </div>
          <span className={'htag ' + f.ht}>{f.htl}</span>
        </div>
        <Stats sts={f.sts} />
        <div style={{ fontSize: 9, color: 'var(--mu)', marginBottom: 3 }}>{dotLbl}</div>
        <Dots dots={f.dots} yes="dy" no="dn-d" mark />
        <ConfBar label={cbLbl} p={f.conf} />
        {f.bets.map((b, j) => <BetRow key={j} l={b.l} o={b.o} fmt={fmt} />)}
        {f.note && <div className="fp-note">{f.note}</div>}
      </div>
    );
  });
}

/* ── Shots (curated) ── */
function ShotsTab({ m, fmt }) {
  if (!m.shots || !m.shots.length) return <Empty>No featured shot props</Empty>;
  return m.shots.map((s, i) => (
    <div key={i} className={'fpl' + (s.hot ? ' hot' : '')}>
      <div className="fp-top">
        <div><div className="fp-nm">{s.nm}</div><div className="fp-cl">{s.cl}</div></div>
        <span className={'htag ' + s.ht}>{s.htl}</span>
      </div>
      <Stats sts={s.sts} />
      <ConfBar label="Had a shot" p={s.sH} fill="f-bl" color="var(--ac2)" />
      <ConfBar label="Shot on target" p={s.sotH} fill="f-pu" color="var(--pur)" delay={0.06} />
      <div style={{ fontSize: 9, color: 'var(--mu)', margin: '4px 0 2px' }}>Last 10 shots (blue) / SOT (purple)</div>
      <Dots dots={s.sd} cls="db" />
      <Dots dots={s.sd2} cls="dp" />
      <div style={{ marginTop: 6 }}>{s.bets.map((b, j) => <BetRow key={j} l={b.l} o={b.o} fmt={fmt} />)}</div>
    </div>
  ));
}

/* ── Easy bets ── */
function EasyTab({ m, fmt }) {
  return (m.easy || []).map((e, i) => (
    <Copyable key={i} className={'ebet' + (e.star ? ' star' : '')} icon={false} copy={`${e.p} @ ${fmtOdds(e.o, fmt)}`}>
      <div className="eb-l">
        <div className="eb-cat">{e.c}</div>
        <div className="eb-pick">{e.p} <span className="copy-ico">⧉</span></div>
        <div className="eb-odds">{fmtOdds(e.o, fmt)}</div>
      </div>
      <div>
        <span className={'eb-cf ' + ecls(e.cf)}>{e.cf}%</span>
        <div className="cb-tr" style={{ width: 80, marginTop: 4 }}>
          <motion.div className={'cb-fi ' + cfill(e.cf)} initial={{ width: 0 }} animate={{ width: e.cf + '%' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>
    </Copyable>
  ));
}

/* ── 📊 Model ── */
function ModelTab({ m, fmt, rat }) {
  if (!rat) return <Empty>Awaiting results.</Empty>;
  const mk = markets(rat, m.hT, m.aT);
  const dH = amToDec(m.odds.h), dD = amToDec(m.odds.d), dA = amToDec(m.odds.a);
  const fair = devig([dH, dD, dA]);
  const rated = rat.has(m.hT) || rat.has(m.aT);
  const pc = x => Math.round(x * 100);
  const sgn = x => (x >= 0 ? '+' : '') + x;
  const findO = re => { const e = (m.easy || []).find(x => re.test(x.p || '')); return e ? amToDec(e.o) : null; };
  const dOver = findO(/\bover\s*2\.5\b/i), dBtts = findO(/btts|both teams/i);
  const isVal = (p, dec, ref) => dec && ref != null && ev(p, dec) > 0 && (p - ref) > 0.04;
  const meta = (p, dec, ref) => {
    const bits = []; if (ref != null) bits.push('mkt ' + pc(ref) + '%');
    return '';
  };
  const Row = ({ label, p, dec, refp, fill }) => (
    <ConfBar label={<>{label}{isVal(p, dec, refp) && <span className="val-chip">VALUE</span>}</>} p={pc(p)} fill={fill} sub={meta(p, dec, refp)} />
  );
  return (
    <div className="pred-grid">
      <div className="psec">
        <div className="psec-t">Match result</div>
        <Row label={m.hT + ' win'} p={mk.home} dec={dH} refp={fair[0]} fill="f-hi" />
        <Row label="Draw" p={mk.draw} dec={dD} refp={fair[1]} fill="f-md" />
        <Row label={m.aT + ' win'} p={mk.away} dec={dA} refp={fair[2]} fill="f-hi" />
      </div>
      <div className="psec">
        <div className="psec-t">Goals</div>
        <Row label="Over 2.5 goals" p={mk.over25} dec={dOver} refp={dOver ? 1 / dOver : null} fill="f-bl" />
        <Row label="Both teams score" p={mk.btts} dec={dBtts} refp={dBtts ? 1 / dBtts : null} fill="f-pu" />
        <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>Projected goals: <b style={{ color: 'var(--tx)' }}>{m.hT} {mk.lh.toFixed(2)}</b> — <b style={{ color: 'var(--tx)' }}>{mk.la.toFixed(2)} {m.aT}</b></div>
      </div>
      <div className="ref-box" style={{ gridColumn: '1/-1', marginTop: 2 }}>
        <b style={{ color: 'var(--tx)' }}>AI confidence out of 100</b> — never a guarantee. For entertainment — never stake more than you can afford to lose.
      </div>
    </div>
  );
}

/* ── ⚡ Parlay ── */
function ParlayTab({ m, fmt, rat }) {
  const { safe, value } = buildParlay(m, rat);
  return (
    <div>
      {safe && <ParlayCard title="🟢 Safe parlay — built to hit" sub="Highest-confidence legs only · lower payout, higher strike rate" slip={safe} fmt={fmt} />}
      {value && <ParlayCard title="⚡ Value parlay — higher risk / reward" sub="Bigger payout, lower strike rate · distinct from the safe slip" slip={value} fmt={fmt} />}
      <div style={{ fontSize: 9, color: 'var(--dm)', lineHeight: 1.5, marginBottom: 6 }}>
        Combined hit % multiplies each leg’s model confidence (assumes legs are independent — correlated legs like win + over may vary). Higher hit % = safer, lower payout.
      </div>
      {m.upsetNote && <div className="upset-box">⚠ {m.upsetNote}</div>}
      {m.ref && <div className="ref-box">{m.ref}</div>}
    </div>
  );
}
function ParlayCard({ title, sub, slip, fmt }) {
  const { legs, metrics, grade } = slip;
  const hit = Math.round(metrics.prob * 100);
  const ret = metrics.dec ? `+${metrics.dec.toFixed(2)}x · $10→$${(metrics.dec * 10).toFixed(0)}` : '—';
  const copy = title.replace(/[^\x20-\x7e]/g, '').trim() + '\n' + legs.map((l, i) => `${i + 1}. ${l.p} @ ${fmtOdds(l.o, fmt)}`).join('\n') + `\nEst. hit ~${hit}% · return ${ret}`;
  return (
    <div className="parlay">
      <div className="pl-hd">
        <span>{title}</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span className="pl-grade" style={{ background: grade.bg, border: '1px solid ' + grade.bd, color: grade.col }}>{grade.lbl} {hit}% hit</span>
          <Copyable copy={copy} icon={false} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(45,200,160,.12)', border: '1px solid rgba(45,200,160,.35)', color: 'var(--ac)' }} title="Copy parlay">⧉</Copyable>
        </span>
      </div>
      <div className="pl-sub">{sub}</div>
      {legs.map((l, i) => (
        <Copyable key={i} className="pl-leg" icon={false} copy={`${l.p} @ ${fmtOdds(l.o, fmt)}`}>
          <span className="pl-n">{i + 1}</span><span className="pl-pk">{l.p}</span><span className="pl-od">{fmtOdds(l.o, fmt)}</span><span className="copy-ico">⧉</span>
        </Copyable>
      ))}
      <div className="pl-ret">Est. combined hit <span style={{ color: grade.col }}>~{hit}%</span> · return <span>{ret}</span></div>
    </div>
  );
}

/* ── shared bits ── */
function Stats({ sts }) {
  return <div className="fp-sts">{(sts || []).map((s, i) => <div key={i} className="fst"><div className="fst-l">{s[0]}</div><div className="fst-v">{s[1]}</div></div>)}</div>;
}
function Dots({ dots, yes, no, cls, mark }) {
  return <div className="dots">{(dots || []).map((d, i) => {
    const c = cls ? cls : d ? yes : no;
    const ch = mark ? (d ? '✓' : '✗') : (d ? '✓' : '–');
    return <div key={i} className={'dot ' + c}>{ch}</div>;
  })}</div>;
}
function BetRow({ l, o, fmt }) {
  return (
    <Copyable className="bet-row" icon={false} copy={`${l} @ ${o.map(x => fmtOdds(x, fmt)).join(' / ')}`}>
      <span className="br-l">{l}</span>
      <div className="br-os">{o.map((x, i) => <span key={i} className="br-o">{fmtOdds(x, fmt)}</span>)}<span className="copy-ico">⧉</span></div>
    </Copyable>
  );
}
function Empty({ children }) {
  return <p style={{ fontSize: 11, color: 'var(--mu)', padding: '8px 0' }}>{children}</p>;
}
