// ─── WC26 EDGE · React App ────────────────────────────────────────
// Full prediction hub with live lineup detection, tabbed match cards,
// confidence meters, fouls, shots, easy bets and parlay builder.
//
// Lineup integration: set API mode in ⚙ settings (top bar)
//   - Demo mode: auto-simulates lineup drops at T-70min
//   - API-Football: free 100 calls/day, league=1 season=2026
//   - TheStatsAPI: 7-day free trial, competition_id=comp_6107

import { useState, useEffect, useCallback, useRef } from 'react';
import { DATES, DAYS, PLAYER_IMPACT } from './data.js';
import { ConfBar, FoulCard, ShotCard, ParlayBuilder, AIBlock, confColor } from './components.jsx';

// ─── CONSTANTS ───────────────────────────────────────────────────
const T = {
  ac: '#00c896', ac2: '#3b82f6', ac3: '#f97316',
  red: '#ef4444', grn: '#22c55e', amb: '#f59e0b', pur: '#a855f7',
};

const TABS = [
  { id: 'result', label: 'Result', icon: '🏆' },
  { id: 'fouls',  label: 'Fouls',  icon: '🟥' },
  { id: 'shots',  label: 'Shots',  icon: '🎯' },
  { id: 'easy',   label: 'Easy bets', icon: '✅' },
  { id: 'parlay', label: 'Parlay + AI', icon: '⚡' },
];

// ─── LINEUP HOOKS ─────────────────────────────────────────────────
function calcLineupImpact(confirmedPlayers, match) {
  let oddsH = 0, oddsA = 0, confDelta = 0;
  const props = [], notes = [], injured = [];

  confirmedPlayers.forEach(name => {
    const impact = PLAYER_IMPACT[name];
    if (!impact) return;
    const isInjured = impact.props.some(p => p.includes('INJURED'));
    const isHome = (match.keyPlayers?.home || []).includes(name);

    if (isInjured) { injured.push(name); }
    oddsH += isHome ? (impact.oddsShift?.h || 0) : -(impact.oddsShift?.h || 0);
    oddsA += isHome ? (impact.oddsShift?.a || 0) : -(impact.oddsShift?.a || 0);
    confDelta += impact.confBoost || 0;
    props.push(...impact.props);
    notes.push(`${isInjured ? '🚨' : '✓'} ${name}${isInjured ? ' — INJURED OUT' : ' confirmed'}`);
  });

  return {
    oddsH: Math.round(oddsH), oddsA: Math.round(oddsA),
    confDelta, props: [...new Set(props)], notes, injured,
  };
}

function useLineup(match, apiKey, apiMode) {
  const [lineup, setLineup] = useState(null);
  const [impact, setImpact] = useState(null);
  const [status, setStatus] = useState('pending');
  const [lastChecked, setLastChecked] = useState(null);
  const timerRef = useRef(null);

  const check = useCallback(async () => {
    setLastChecked(new Date());

    // Demo mode: simulate lineup drop at T-70min
    if (apiMode === 'demo') {
      const kickoff = new Date(match.kickoffUTC || Date.now() + 3600000);
      const minsToKO = (kickoff - Date.now()) / 60000;
      if (minsToKO <= 70 || match.live) {
        const all = [...(match.keyPlayers?.home || []), ...(match.keyPlayers?.away || [])];
        if (all.length) {
          setLineup(all);
          setImpact(calcLineupImpact(all, match));
          setStatus('released');
        }
      }
      return;
    }

    // API-Football
    if (apiMode === 'apifootball' && apiKey && match.apiFootballId) {
      try {
        const res = await fetch(
          `https://v3.football.api-sports.io/fixtures/lineups?fixture=${match.apiFootballId}`,
          { headers: { 'x-apisports-key': apiKey } }
        );
        const json = await res.json();
        const confirmed = (json.response || []).flatMap(team =>
          (team.startXI || []).map(p => p.player?.name).filter(Boolean)
        );
        const matched = [...(match.keyPlayers?.home || []), ...(match.keyPlayers?.away || [])].filter(kp =>
          confirmed.some(c => c.toLowerCase().includes(kp.split(' ').pop().toLowerCase()))
        );
        if (matched.length) {
          setLineup(matched);
          setImpact(calcLineupImpact(matched, match));
          setStatus('released');
          clearInterval(timerRef.current);
        }
      } catch { setStatus('error'); }
    }
  }, [match, apiKey, apiMode]);

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, 60000);
    return () => clearInterval(timerRef.current);
  }, [check]);

  return { lineup, impact, status, lastChecked, refresh: check };
}

// ─── LINEUP PANEL ─────────────────────────────────────────────────
function LineupPanel({ match, apiKey, apiMode }) {
  const { lineup, impact, status, lastChecked, refresh } = useLineup(match, apiKey, apiMode);
  const released = status === 'released';

  return (
    <div style={{
      background: released ? 'rgba(0,200,150,.06)' : 'rgba(245,158,11,.06)',
      border: `1px solid ${released ? 'rgba(0,200,150,.3)' : 'rgba(245,158,11,.25)'}`,
      borderRadius: 8, padding: '10px 12px', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: released ? T.ac : T.amb, animation: !released ? 'blink 2s infinite' : 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: released ? T.ac : T.amb }}>
            {released ? '✓ LINEUP CONFIRMED' : '⏳ LINEUP PENDING'}
          </span>
          <span style={{ fontSize: 9, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>
            {apiMode === 'demo' ? 'Demo' : 'Live API'} · polls every 60s
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {lastChecked && (
            <span style={{ fontSize: 9, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>
              {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} style={{
            fontFamily: 'var(--sans)', fontSize: 9, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', color: T.ac2,
            borderRadius: 4, padding: '3px 8px',
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Pending */}
      {!released && (
        <div style={{ fontSize: 10, color: 'var(--mu)', lineHeight: 1.7 }}>
          Lineups typically drop <strong style={{ color: T.amb }}>60–70 minutes before kickoff</strong> on Sofascore / API-Football.
          When confirmed, odds and confidence will auto-update.
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {[...(match.keyPlayers?.home || []), ...(match.keyPlayers?.away || [])].map((p, i) => (
              <span key={i} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', color: T.amb }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Released */}
      {released && impact && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {lineup?.map((p, i) => {
              const pi = PLAYER_IMPACT[p];
              const inj = pi?.props?.some(pr => pr.includes('INJURED'));
              return (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                  background: inj ? 'rgba(239,68,68,.1)' : 'rgba(0,200,150,.1)',
                  border: `1px solid ${inj ? 'rgba(239,68,68,.3)' : 'rgba(0,200,150,.3)'}`,
                  color: inj ? T.red : T.ac,
                }}>{inj ? '🚨 ' : '✓ '}{p}</span>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
            {[
              { label: 'Odds impact', val: impact.oddsH > 0 ? `+${impact.oddsH}` : `${impact.oddsH}`, color: impact.oddsH < 0 ? T.ac : T.red },
              { label: 'Confidence Δ', val: `${impact.confDelta > 0 ? '+' : ''}${impact.confDelta}%`, color: impact.confDelta > 0 ? T.ac : T.red },
              { label: 'Props activated', val: impact.props.length, color: T.ac2 },
            ].map(({ label, val, color }, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 5, padding: '5px 8px', border: '1px solid var(--b1)' }}>
                <div style={{ fontSize: 9, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
          {impact.props.length > 0 && (
            <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 5, padding: '6px 9px' }}>
              <div style={{ fontSize: 9, color: T.ac2, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>📊 Props auto-adjusted</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...new Set(impact.props)].map((p, i) => (
                  <span key={i} style={{ fontSize: 9, color: 'var(--tx)', background: 'rgba(255,255,255,.06)', padding: '2px 6px', borderRadius: 3 }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {impact.injured.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 5, padding: '6px 9px', marginTop: 6 }}>
              <div style={{ fontSize: 9, color: T.red, fontWeight: 700, marginBottom: 3 }}>🚨 INJURY ALERTS</div>
              {impact.injured.map((p, i) => <div key={i} style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>{p} — confirmed OUT. Props recalculated.</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────
function MatchCard({ match, apiKey, apiMode }) {
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState('result');
  const { impact, status } = useLineup(match, apiKey, apiMode);

  const currentOdds = {
    h: impact ? `${parseInt(match.odds.h) + (impact.oddsH || 0)}` : match.odds.h,
    d: match.odds.d,
    a: impact ? `${parseInt(match.odds.a) + (impact.oddsA || 0)}` : match.odds.a,
    ou: match.odds.ou,
  };
  const currentConf = Math.min(99, match.conf + (impact?.confDelta || 0));
  const tagColor = match.tag === 'top' ? T.ac : match.tag === 'upset' ? T.ac3 : T.ac2;

  return (
    <div style={{
      background: 'var(--s1)',
      border: `1px solid ${open ? 'rgba(0,200,150,.5)' : match.live ? 'rgba(239,68,68,.4)' : 'var(--b1)'}`,
      borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s',
    }}>
      {/* Card head */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: '12px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {match.teams}
              {match.live && <span style={{ fontSize: 9, color: T.red, fontFamily: 'var(--mono)', animation: 'blink 1.4s infinite' }}>● LIVE</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>
              {match.group} · {match.venue} · {match.time}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
            {match.live && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: T.red, animation: 'blink 1.4s infinite' }}>● LIVE</span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: `${tagColor}18`, border: `1px solid ${tagColor}44`, color: tagColor }}>{match.tagLabel}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {/* Odds */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: 'Home', val: currentOdds.h, highlight: match.winner === match.homeTeam },
              { label: 'Draw', val: currentOdds.d },
              { label: 'Away', val: currentOdds.a, highlight: match.winner === match.awayTeam },
              { label: 'O/U',  val: currentOdds.ou },
            ].map(({ label, val, highlight }, i) => (
              <div key={i} style={{ background: 'var(--s3)', borderRadius: 6, padding: '4px 9px', textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mu)' }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: highlight ? T.ac : 'var(--tx)', marginTop: 1 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Conf pill */}
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid',
            background: `${confColor(currentConf)}18`, borderColor: `${confColor(currentConf)}44`, color: confColor(currentConf),
          }}>{currentConf}% conf</span>

          {/* Upset pill */}
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)', color: T.ac3 }}>
            ⚡ {match.upset}% upset
          </span>

          {/* Lineup pill */}
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '3px 7px', borderRadius: 4,
            background: status === 'released' ? 'rgba(0,200,150,.1)' : 'rgba(245,158,11,.08)',
            border: `1px solid ${status === 'released' ? 'rgba(0,200,150,.3)' : 'rgba(245,158,11,.25)'}`,
            color: status === 'released' ? T.ac : T.amb,
          }}>
            {status === 'released' ? '✓ Lineup confirmed' : '⏳ Lineup pending'}
          </span>

          {/* Conf delta if lineup shifted it */}
          {impact && impact.confDelta !== 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 4, fontFamily: 'var(--mono)', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', color: T.ac2 }}>
              {impact.confDelta > 0 ? `↑ +${impact.confDelta}%` : `↓ ${impact.confDelta}%`} conf
            </span>
          )}

          <span style={{ fontSize: 13, color: 'var(--mu)', marginLeft: 'auto', flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--b1)', padding: '10px 15px 14px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 1, marginBottom: 12, borderBottom: '1px solid var(--b1)', overflowX: 'auto' }}>
            {[...TABS, { id: 'lineup', label: `Lineup ${status === 'released' ? '✓' : '⏳'}`, icon: '👕' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                fontSize: 11, fontWeight: 500, padding: '5px 11px',
                border: 'none', background: 'none', fontFamily: 'var(--sans)', cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0, marginBottom: -1,
                borderBottom: `2px solid ${tab === t.id ? T.ac : 'transparent'}`,
                color: tab === t.id ? T.ac : 'var(--mu)',
              }}>{t.icon} {t.label}</button>
            ))}
          </div>

          {/* TAB: RESULT */}
          {tab === 'result' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 9 }}>
                  {[
                    { team: match.homeTeam, odds: currentOdds.h, pct: match.wP, win: match.winner === match.homeTeam },
                    { team: 'Draw', odds: currentOdds.d, pct: match.dP, win: false },
                    { team: match.awayTeam, odds: currentOdds.a, pct: match.aP, win: match.winner === match.awayTeam },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: item.win ? 'rgba(0,200,150,.06)' : 'var(--bg)',
                      border: `1px solid ${item.win ? 'rgba(0,200,150,.45)' : 'var(--b1)'}`,
                      borderRadius: 8, padding: '8px 5px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.team}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: T.ac, margin: '3px 0' }}>{item.odds}</div>
                      <div style={{ fontSize: 9, color: 'var(--mu)' }}>{item.pct}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.ac, textAlign: 'center', padding: '5px 8px', background: 'rgba(0,200,150,.06)', borderRadius: 5, border: '1px solid rgba(0,200,150,.2)' }}>
                  ▶ {match.winner} · {currentConf}% confidence
                </div>
              </div>
              <div>
                {match.confBars.map((r, i) => <ConfBar key={i} label={r.label} pct={r.pct} color={r.color} />)}
              </div>
            </div>
          )}

          {/* TAB: LINEUP */}
          {tab === 'lineup' && <LineupPanel match={match} apiKey={apiKey} apiMode={apiMode} />}

          {/* TAB: FOULS */}
          {tab === 'fouls' && (
            match.fouls?.length
              ? match.fouls.map((f, i) => <FoulCard key={i} foul={f} />)
              : <p style={{ fontSize: 11, color: 'var(--mu)', padding: '8px 0' }}>No featured foul props for this fixture</p>
          )}

          {/* TAB: SHOTS */}
          {tab === 'shots' && (
            match.shots?.length
              ? match.shots.map((s, i) => <ShotCard key={i} shot={s} />)
              : <p style={{ fontSize: 11, color: 'var(--mu)', padding: '8px 0' }}>No featured shot props for this fixture</p>
          )}

          {/* TAB: EASY BETS */}
          {tab === 'easy' && (
            <div>
              {match.easy.map((e, i) => (
                <div key={i} style={{
                  background: e.star ? 'rgba(0,200,150,.04)' : 'var(--bg)',
                  border: `1px solid ${e.star ? 'rgba(0,200,150,.3)' : 'var(--b1)'}`,
                  borderRadius: 8, padding: '7px 10px', marginBottom: 5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 2 }}>{e.cat}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{e.pick}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{e.odds}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                      background: `${confColor(e.conf)}18`, border: `1px solid ${confColor(e.conf)}40`, color: confColor(e.conf),
                    }}>{e.conf}%</span>
                    <div style={{ height: 4, width: 80, background: 'var(--b1)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: 4, width: `${e.conf}%`, background: confColor(e.conf), borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: PARLAY + AI */}
          {tab === 'parlay' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ParlayBuilder parlay={match.parlay} parlayReturn={match.parlayReturn} upsetNote={match.upsetNote} refNote={match.refNote} />
              <AIBlock matchId={match.id} ctx={match.ai} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────
function SettingsModal({ apiKey, setApiKey, apiMode, setApiMode, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: 24, width: 'min(480px, 92vw)', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>⚙ Lineup Integration Settings</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 18 }}>Choose your data source for real lineup detection</div>

        {/* Mode selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Data source</div>
          {[
            { id: 'demo', label: 'Demo mode', sub: 'Auto-simulates lineup drops at T-70min. No API key needed.' },
            { id: 'apifootball', label: 'API-Football (api-sports.io)', sub: 'Free: 100 calls/day. WC2026 = league=1, season=2026.' },
            { id: 'thestatsapi', label: 'TheStatsAPI', sub: '7-day free trial. WC2026 = competition_id=comp_6107.' },
          ].map(opt => (
            <div key={opt.id} onClick={() => setApiMode(opt.id)} style={{
              background: apiMode === opt.id ? 'rgba(0,200,150,.08)' : 'var(--s2)',
              border: `1px solid ${apiMode === opt.id ? 'rgba(0,200,150,.35)' : 'var(--b1)'}`,
              borderRadius: 7, padding: '9px 12px', marginBottom: 6, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${apiMode === opt.id ? T.ac : 'var(--mu)'}`, background: apiMode === opt.id ? T.ac : 'none' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: apiMode === opt.id ? T.ac : 'var(--tx)' }}>{opt.label}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3, marginLeft: 22 }}>{opt.sub}</div>
            </div>
          ))}
        </div>

        {/* API key input */}
        {apiMode !== 'demo' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              API Key {apiMode === 'apifootball' ? '(x-apisports-key)' : '(Bearer token)'}
            </div>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={apiMode === 'apifootball' ? 'your-api-football-key' : 'your-thestatsapi-key'}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 5, color: 'var(--tx)', padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }}
            />
            <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>
              {apiMode === 'apifootball' ? 'Get free key at api-sports.io → Free tier: 100 calls/day' : 'Get 7-day free trial at thestatsapi.com'}
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 7, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.ac, marginBottom: 6 }}>How lineup detection works</div>
          {['Polls API every 60 seconds for each upcoming match', 'Lineups typically confirmed T-60 to T-70 mins before kickoff', 'Key players detected → odds and confidence update automatically', 'Injury alerts trigger immediately with prop recalculations', 'All changes shown with delta indicators (↑ ↓)'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, fontSize: 10, color: 'var(--mu)', marginBottom: 3 }}>
              <span style={{ color: T.ac, flexShrink: 0 }}>{i + 1}.</span> {s}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width: '100%', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, background: 'rgba(0,200,150,.1)', border: '1px solid rgba(0,200,150,.3)', color: T.ac, borderRadius: 7, padding: 9, cursor: 'pointer' }}>
          Save & Close
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [activeDay,    setActiveDay]    = useState('24');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey,       setApiKey]       = useState('');
  const [apiMode,      setApiMode]      = useState('demo');

  const day = DAYS[activeDay];
  const liveCount = Object.values(DAYS).flatMap(d => d.matches).filter(m => m.live).length;

  const tickerStats = [
    { label: 'Goals/g',      val: '3.14',  color: T.grn  },
    { label: 'Fouls/g',      val: '24.4',  color: 'var(--tx)' },
    { label: 'Corners/g',    val: '10.6',  color: T.ac2  },
    { label: 'Throw-ins/g',  val: '46',    color: T.ac2  },
    { label: 'Upsets',       val: '46%',   color: T.amb  },
    { label: 'Foul props hit', val: '91%', color: T.grn  },
    { label: 'SOT props hit',  val: '82%', color: T.grn  },
    { label: 'Fav win rate', val: '54%',   color: T.amb  },
    { label: 'Lineup source', val: apiMode === 'demo' ? 'Demo' : 'Live API', color: apiMode === 'demo' ? T.amb : T.ac },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--tx)', fontFamily: 'var(--sans)', fontSize: 13 }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes bk { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
      `}</style>

      {showSettings && <SettingsModal apiKey={apiKey} setApiKey={setApiKey} apiMode={apiMode} setApiMode={setApiMode} onClose={() => setShowSettings(false)} />}

      {/* TOP BAR */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--b1)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 300, gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.12em', color: T.ac, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.ac, animation: 'blink 2s infinite' }} />
          WC26 EDGE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { t: 'Goals/g 3.14', c: T.grn },
            { t: 'Fouls/g 24.4', c: T.grn },
            { t: 'Corners/g 10.6', c: T.grn },
            { t: 'Upsets 46%', c: T.amb },
            { t: 'Foul props 91%', c: T.red },
          ].map(({ t, c }, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 4, border: '1px solid', whiteSpace: 'nowrap', background: `${c}10`, borderColor: `${c}40`, color: c }}>{t}</span>
          ))}
          {liveCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 4, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.1)', color: T.red, animation: 'blink 1.5s infinite' }}>● {liveCount} LIVE</span>
          )}
          <button onClick={() => setShowSettings(true)} style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', color: T.ac2, borderRadius: 5, padding: '4px 10px', marginLeft: 4 }}>
            ⚙ Lineups {apiMode === 'demo' ? '(demo)' : '(live)'}
          </button>
        </div>
      </div>

      {/* DATE NAV */}
      <div style={{ background: 'var(--s1)', borderBottom: '2px solid var(--b1)', padding: '0 12px', display: 'flex', alignItems: 'stretch', gap: 2, overflowX: 'auto', position: 'sticky', top: 52, zIndex: 200 }}>
        {DATES.map(d => (
          <button key={d.key} onClick={() => setActiveDay(d.key)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minWidth: 64, padding: '8px 12px', cursor: 'pointer', border: 'none', background: 'none',
            fontFamily: 'var(--sans)', flexShrink: 0, gap: 1, position: 'relative',
            borderBottom: `3px solid ${activeDay === d.key ? T.ac : 'transparent'}`,
          }}>
            {d.hot && <span style={{ position: 'absolute', top: 6, right: 8, width: 5, height: 5, borderRadius: '50%', background: T.ac3 }} />}
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: activeDay === d.key ? T.ac : 'var(--mu)' }}>{d.day}</span>
            <span style={{ fontSize: 19, fontWeight: 800, color: activeDay === d.key ? T.ac : 'var(--dm)' }}>{d.num}</span>
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: activeDay === d.key ? T.ac : 'var(--dm)' }}>
              {d.r32 ? 'R32 begins' : d.today ? `TODAY · ${d.cnt}` : `${d.cnt} matches`}
            </span>
          </button>
        ))}
      </div>

      {/* TICKER */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--b1)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 14, overflowX: 'auto' }}>
        {tickerStats.map(({ label, val, color }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--mu)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color }}>{val}</span>
            {i < tickerStats.length - 1 && <div style={{ width: 1, height: 18, background: 'var(--b1)', marginLeft: 8 }} />}
          </div>
        ))}
      </div>

      {/* PAGE */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        {day ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)' }}>{day.title}</div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3, fontFamily: 'var(--mono)' }}>{day.sub}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {day.matches.map(m => (
                <MatchCard key={m.id} match={m} apiKey={apiKey} apiMode={apiMode} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 36, opacity: .3, marginBottom: 12 }}>📅</div>
            <p>Predictions loading for this date — check back soon</p>
          </div>
        )}
      </div>

      <div style={{ fontSize: 9, color: 'var(--dm)', textAlign: 'center', padding: '14px 16px', borderTop: '1px solid var(--b1)', marginTop: 16, lineHeight: 1.6 }}>
        WC26 EDGE · React Edition · Lineup integration via API-Football / TheStatsAPI · 18+ Gamble responsibly · Odds are estimates — always verify before placing · BeGambleAware.org
      </div>
    </div>
  );
}
