// ─── WC26 EDGE · MatchCard ─────────────────────────────────────
import { useState } from 'react';
import { C, confColor, confClass, ConfBar, FoulCard, ShotCard, AIBlock } from './components';

// ── Tab strip ─────────────────────────────────────────────────
function Tabs({ tabs, active, onSwitch }) {
  return (
    <div style={{
      display: 'flex', gap: 2, marginBottom: 12, borderBottom: `1px solid ${C.b1}`,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onSwitch(t.id)}
          style={{
            fontSize: 11, fontWeight: 500, padding: '6px 12px', border: 'none', background: 'none',
            fontFamily: 'Inter, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            borderBottom: `2px solid ${active === t.id ? C.ac : 'transparent'}`,
            color: active === t.id ? C.ac : C.mu, marginBottom: -1, transition: 'color .1s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Result tab ─────────────────────────────────────────────────
function ResultTab({ match }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Result boxes */}
      <div style={{ background: C.s3, border: `1px solid ${C.b1}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: C.mu, marginBottom: 9 }}>
          Result prediction
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          {[
            { team: match.homeTeam, odds: match.odds.h, pct: match.wP, win: match.winner === match.homeTeam },
            { team: 'Draw',         odds: match.odds.d, pct: match.dP, win: false },
            { team: match.awayTeam, odds: match.odds.a, pct: match.aP, win: match.winner === match.awayTeam },
          ].map((item, i) => (
            <div key={i} style={{
              background: item.win ? `${C.ac}08` : C.s1,
              border: `1px solid ${item.win ? C.ac + '50' : C.b1}`,
              borderRadius: 7, padding: '8px 5px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.team}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: C.ac, margin: '3px 0' }}>
                {item.odds}
              </div>
              <div style={{ fontSize: 9, color: C.mu }}>{item.pct}%</div>
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.ac, textAlign: 'center', padding: 5,
          background: `${C.ac}08`, borderRadius: 5, border: `1px solid ${C.ac}25`,
        }}>
          ▶ {match.winner} · {match.conf}% confidence
        </div>
      </div>

      {/* Confidence bars */}
      <div style={{ background: C.s3, border: `1px solid ${C.b1}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: C.mu, marginBottom: 9 }}>
          Confidence breakdown
        </div>
        {match.cbars.map((r, i) => (
          <ConfBar key={i} label={r.l} pct={r.p} color={r.color} />
        ))}
      </div>
    </div>
  );
}

// ── Easy bets tab ──────────────────────────────────────────────
function EasyTab({ easy }) {
  return (
    <div>
      {easy.map((e, i) => (
        <div key={i} style={{
          background: e.star ? `${C.ac}05` : C.s1,
          border: `1px solid ${e.star ? C.ac + '30' : C.b1}`,
          borderRadius: 8, padding: '7px 10px', marginBottom: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: C.mu, marginBottom: 2 }}>
              {e.cat}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx }}>{e.pick}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.mu, marginTop: 1 }}>{e.odds}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
              background: `${confColor(e.conf)}18`, border: `1px solid ${confColor(e.conf)}40`, color: confColor(e.conf),
            }}>{e.conf}%</span>
            <div style={{ height: 4, width: 80, background: C.b1, borderRadius: 2, marginTop: 4 }}>
              <div style={{ height: 4, width: `${e.conf}%`, background: confColor(e.conf), borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Parlay + AI tab ────────────────────────────────────────────
function ParlayTab({ match }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        {/* Parlay */}
        <div style={{ background: `${C.ac}07`, border: `1px solid ${C.ac}25`, borderRadius: 9, padding: '11px 13px', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.ac, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            ⚡ Parlay builder
          </div>
          {match.parlay.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0',
              borderBottom: `1px solid ${C.ac}12`, fontSize: 10, color: C.mu,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', background: `${C.ac}18`, color: C.ac,
                fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ color: C.tx, fontWeight: 600 }}>{p.pick}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: C.mu, marginLeft: 'auto' }}>{p.odds}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.mu, borderTop: `1px solid ${C.ac}15`, paddingTop: 5, marginTop: 4 }}>
            Est. return: <span style={{ color: C.ac, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{match.parlayRet}</span>
          </div>
        </div>

        {/* Upset box */}
        {match.upset && (
          <div style={{
            background: `${C.ac3}08`, border: `1px solid ${C.ac3}25`, borderRadius: 7,
            padding: '7px 10px', fontSize: 10, color: '#fb923c', lineHeight: 1.6, marginBottom: 6,
          }}>⚠ {match.upset}</div>
        )}

        {/* Ref/note box */}
        {match.ref && (
          <div style={{
            background: `${C.ac2}08`, border: `1px solid ${C.ac2}20`, borderRadius: 7,
            padding: '7px 10px', fontSize: 10, color: '#60a5fa', lineHeight: 1.5,
          }}>{match.ref}</div>
        )}
      </div>

      {/* AI */}
      <AIBlock matchId={match.id} ctx={match.ai} />
    </div>
  );
}

// ── MatchCard (main export) ────────────────────────────────────
export default function MatchCard({ match }) {
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState('result');

  const tagColor = match.tag === 'top' ? C.ac : match.tag === 'upset' ? C.ac3 : C.ac2;

  const TABS = [
    { id: 'result', label: '🏆 Result' },
    { id: 'fouls',  label: `🟥 Fouls (${match.fouls.length})` },
    { id: 'shots',  label: `🎯 Shots (${match.shots.length})` },
    { id: 'easy',   label: '✅ Easy bets' },
    { id: 'parlay', label: '⚡ Parlay + AI' },
  ];

  return (
    <div style={{
      background: C.s1,
      border: `1px solid ${open ? C.ac + '55' : match.live ? C.red + '44' : C.b1}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color .15s',
    }}>
      {/* ── HEAD (always visible, clickable) ── */}
      <div onClick={() => setOpen(!open)} style={{ padding: '12px 15px', cursor: 'pointer' }}>
        {/* Row 1: teams + tag */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, display: 'flex', alignItems: 'center', gap: 8 }}>
              {match.teams}
              {match.live && (
                <span style={{
                  fontSize: 10, color: C.red, fontFamily: 'JetBrains Mono, monospace',
                  animation: 'blink 1.4s infinite',
                }}>● LIVE</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: C.mu, marginTop: 3 }}>
              {match.group} · {match.venue} · {match.time}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
            {match.live && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 4, background: `${C.red}12`, border: `1px solid ${C.red}35`, color: C.red,
                animation: 'blink 1.4s infinite',
              }}>● LIVE</span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 4, background: `${tagColor}18`, border: `1px solid ${tagColor}44`, color: tagColor,
            }}>{match.tagLabel}</span>
          </div>
        </div>

        {/* Row 2: odds + pills + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {/* Odds */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: 'Home', val: match.odds.h, highlight: match.winner === match.homeTeam },
              { label: 'Draw', val: match.odds.d },
              { label: 'Away', val: match.odds.a, highlight: match.winner === match.awayTeam },
              { label: 'O/U',  val: match.odds.ou },
            ].map(({ label, val, highlight }, i) => (
              <div key={i} style={{ background: C.s3, borderRadius: 6, padding: '5px 9px', textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.05em', color: C.mu }}>{label}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: highlight ? C.ac : C.tx, marginTop: 1 }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Conf pill */}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 4, border: '1px solid',
            background: `${confColor(match.conf)}18`, borderColor: `${confColor(match.conf)}44`, color: confColor(match.conf),
          }}>{match.conf}% conf</span>

          {/* Upset pill */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
            background: `${C.ac3}08`, border: `1px solid ${C.ac3}25`, color: C.ac3,
          }}>⚡ {match.upset}% upset</span>

          {/* Toggle */}
          <span style={{ fontSize: 14, color: C.mu, marginLeft: 'auto', flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </div>

      {/* ── EXPANDED BODY ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.b1}`, padding: '11px 15px 15px' }}>
          <Tabs tabs={TABS} active={tab} onSwitch={setTab} />

          {tab === 'result' && <ResultTab match={match} />}

          {tab === 'fouls' && (
            match.fouls.length
              ? match.fouls.map((f, i) => <FoulCard key={i} foul={f} />)
              : <p style={{ fontSize: 11, color: C.mu }}>No featured foul props for this fixture</p>
          )}

          {tab === 'shots' && (
            match.shots.length
              ? match.shots.map((s, i) => <ShotCard key={i} shot={s} />)
              : <p style={{ fontSize: 11, color: C.mu }}>No featured shot props for this fixture</p>
          )}

          {tab === 'easy' && <EasyTab easy={match.easy} />}

          {tab === 'parlay' && <ParlayTab match={match} />}
        </div>
      )}
    </div>
  );
}
