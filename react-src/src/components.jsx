// ─── WC26 EDGE · Shared UI Components ────────────────────────────

const T = {
  ac: '#00c896', ac2: '#3b82f6', ac3: '#f97316',
  red: '#ef4444', grn: '#22c55e', amb: '#f59e0b', pur: '#a855f7',
};

export const confColor = (p) => p >= 75 ? T.ac : p >= 55 ? T.amb : T.red;
export const confFill  = (p) => `linear-gradient(90deg, ${confColor(p)}55, ${confColor(p)})`;

// ── ConfBar ──────────────────────────────────────────────────────
export function ConfBar({ label, pct, color }) {
  const c = color || confColor(pct);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--mu)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: confColor(pct) }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--s1)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--b1)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${c}55, ${c})`, transition: 'width .5s' }} />
      </div>
    </div>
  );
}

// ── DotRow ───────────────────────────────────────────────────────
export function DotRow({ dots, color, label }) {
  return (
    <div style={{ marginBottom: 5 }}>
      {label && <div style={{ fontSize: 9, color: 'var(--mu)', marginBottom: 3 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {dots.map((d, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 700, flexShrink: 0,
            background: d ? `${color}30` : `${T.red}30`,
            border: `1px solid ${d ? color : T.red}60`,
            color: d ? color : T.red,
          }}>{d ? '✓' : '✗'}</div>
        ))}
      </div>
    </div>
  );
}

// ── HitTag ───────────────────────────────────────────────────────
export function HitTag({ hitClass, hitTag }) {
  const colors = { h100: T.grn, h90: T.grn, h80: T.amb };
  const c = colors[hitClass] || T.amb;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
      background: `${c}18`, border: `1px solid ${c}44`, color: c,
    }}>{hitTag}</span>
  );
}

// ── StatGrid ─────────────────────────────────────────────────────
export function StatGrid({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 7 }}>
      {stats.map(([label, val], i) => (
        <div key={i} style={{ background: 'var(--bg)', borderRadius: 5, padding: '4px 6px', border: '1px solid var(--b1)' }}>
          <div style={{ fontSize: 8, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

// ── BetRow ───────────────────────────────────────────────────────
export function BetRow({ label, odds }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: 'var(--bg)', borderRadius: 5, padding: '5px 8px',
      border: '1px solid var(--b1)', marginBottom: 3, flexWrap: 'wrap', gap: 4,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {odds.map((o, i) => (
          <span key={i} style={{
            fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 5px',
            borderRadius: 4, border: '1px solid var(--b1)', background: 'var(--s2)', color: 'var(--tx)',
          }}>{o}</span>
        ))}
      </div>
    </div>
  );
}

// ── FoulCard ─────────────────────────────────────────────────────
export function FoulCard({ foul }) {
  return (
    <div style={{
      background: 'var(--s1)', border: `1px solid ${foul.hot ? '#00c89650' : 'var(--b1)'}`,
      borderRadius: 8, padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 6, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{foul.name}</div>
          <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 1 }}>{foul.club}</div>
        </div>
        <HitTag hitClass={foul.hitClass} hitTag={foul.hitTag} />
      </div>
      <StatGrid stats={foul.stats} />
      <DotRow dots={foul.dots} color={T.grn} label="Last 10 — committed 1+ foul (✓ yes)" />
      <ConfBar label="Foul prop confidence" pct={foul.conf} />
      {foul.bets.map((b, i) => <BetRow key={i} label={b.label} odds={b.odds} />)}
      {foul.note && (
        <div style={{ fontSize: 10, color: 'var(--mu)', lineHeight: 1.6, marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--b1)' }}>
          {foul.note}
        </div>
      )}
    </div>
  );
}

// ── ShotCard ─────────────────────────────────────────────────────
export function ShotCard({ shot }) {
  return (
    <div style={{
      background: 'var(--s1)', border: `1px solid ${shot.hot ? '#00c89650' : 'var(--b1)'}`,
      borderRadius: 8, padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 6, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{shot.name}</div>
          <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 1 }}>{shot.club}</div>
        </div>
        <HitTag hitClass={shot.hitClass} hitTag={shot.hitTag} />
      </div>
      <StatGrid stats={shot.stats} />
      <ConfBar label="Had a shot (any)" pct={shot.shotHit} color={T.ac2} />
      <ConfBar label="Shot on target" pct={shot.sotHit} color={T.pur} />
      <DotRow dots={shot.sdots} color={T.ac2} label="Last 10 shots 🔵" />
      <DotRow dots={shot.sotdots} color={T.pur} label="Last 10 SOT 🟣" />
      {shot.bets.map((b, i) => <BetRow key={i} label={b.label} odds={b.odds} />)}
    </div>
  );
}

// ── ParlayBuilder ────────────────────────────────────────────────
export function ParlayBuilder({ parlay, parlayReturn, upsetNote, refNote }) {
  return (
    <div style={{ background: 'rgba(0,200,150,.05)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 9, padding: '11px 13px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.ac, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>
        ⚡ Parlay builder
      </div>
      {parlay.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0',
          borderBottom: '1px solid rgba(0,200,150,.08)', fontSize: 10, color: 'var(--mu)',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,200,150,.15)',
            color: T.ac, fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{i + 1}</span>
          <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{p.pick}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{p.odds}</span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: 'var(--mu)', borderTop: '1px solid rgba(0,200,150,.12)', paddingTop: 5, marginTop: 4 }}>
        Est. combined return: <span style={{ color: T.ac, fontFamily: 'var(--mono)', fontWeight: 700 }}>{parlayReturn}</span>
      </div>
      {upsetNote && (
        <div style={{ background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 7, padding: '7px 10px', marginTop: 8, fontSize: 10, color: '#fb923c', lineHeight: 1.6 }}>
          ⚠ {upsetNote}
        </div>
      )}
      {refNote && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 7, padding: '7px 10px', marginTop: 6, fontSize: 10, color: '#60a5fa', lineHeight: 1.5 }}>
          {refNote}
        </div>
      )}
    </div>
  );
}

// ── AIBlock ──────────────────────────────────────────────────────
import { useState } from 'react';

export function AIBlock({ matchId, ctx }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const prompt = `WC 2026 betting analyst. Tournament averages: 24.4 fouls/game, 10.6 corners/game, 46 throw-ins/game, 3.14 goals/game, fav win rate 54%, upset rate 46%.\n\nContext: ${ctx}\n\nBullet format:\n• FOUL PROP: player, bet, confidence %, 1-sentence reason\n• SOT PROP: player, bet, confidence %, 1-sentence reason\n• CORNER BET: specific prop, confidence %\n• THROW-IN BET: specific prop, confidence %\n• LIVE TRIGGER: what to watch in first 20 mins\n• RISK: biggest upset risk factor\n\nMax 180 words. No disclaimers.`;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 450, messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await r.json();
      setResult(d.content?.find(b => b.type === 'text')?.text || 'Unable to generate.');
    } catch {
      setResult('Analysis unavailable — check connection.');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--mu)' }}>
          🤖 AI deep analysis
        </span>
        <button
          onClick={run}
          disabled={loading}
          style={{
            fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(0,200,150,.1)', border: '1px solid rgba(0,200,150,.3)', color: T.ac,
            borderRadius: 5, padding: '4px 12px', transition: 'background .12s',
          }}
        >
          {loading ? 'Analysing…' : 'Analyse ↗'}
        </button>
      </div>
      {loading && (
        <div style={{ display: 'inline-flex', gap: 3 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: T.ac, animation: `bk 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      )}
      {result ? (
        <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result}</div>
      ) : !loading ? (
        <div style={{ fontSize: 10, color: 'var(--mu)' }}>Click Analyse for foul + SOT + corners + throw-ins + live trigger</div>
      ) : null}
    </div>
  );
}
