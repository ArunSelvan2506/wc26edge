// ─── WC26 EDGE · Components ────────────────────────────────────
import { useState } from 'react';

// ── Design tokens ──────────────────────────────────────────────
export const C = {
  bg:   '#0f141b', s1: '#171d27', s2: '#1d2532', s3: '#26303f',
  b1:   '#303d4f', b2: '#3b4a5e',
  tx:   '#e6ecf5', mu: '#90a0b8', dm: '#52647e',
  ac:   '#2dc8a0', ac2: '#5b96ef', ac3: '#fb8c43',
  red:  '#ef6d6d', grn: '#3ccb73', amb: '#f6b23f', pur: '#b079ef',
};

// Copy a bet/pick selection to the clipboard + lightweight toast feedback.
export function copySelection(e, text) {
  if (e) e.stopPropagation();
  const t = String(text).replace(/\s+/g, ' ').trim();
  const done = () => showToast('✓ Copied — ' + t);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(done).catch(done);
  } else { done(); }
}

let toastTimer;
export function showToast(msg) {
  let el = document.getElementById('wc-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wc-toast';
    el.style.cssText = `position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(24px);
      background:${C.s3};border:1px solid ${C.ac};color:${C.tx};font-size:12px;font-weight:600;
      font-family:'Inter',sans-serif;padding:9px 16px;border-radius:9px;box-shadow:0 8px 28px rgba(0,0,0,.55);
      z-index:600;opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;
      max-width:90vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(24px)';
  }, 1700);
}

// Shared style for any tap-to-copy element.
export const copyableStyle = { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' };

export const confColor = (p) => p >= 75 ? C.ac : p >= 55 ? C.amb : C.red;
export const confClass = (p) => p >= 75 ? 'cp-hi' : p >= 55 ? 'cp-md' : 'cp-lo';

// ── ConfBar ────────────────────────────────────────────────────
export function ConfBar({ label, pct, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: C.mu }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, color: confColor(pct) }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 5, background: C.s1, borderRadius: 3, overflow: 'hidden', border: `1px solid ${C.b1}` }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color || confColor(pct), borderRadius: 3, transition: 'width .5s' }} />
      </div>
    </div>
  );
}

// ── HitTag ─────────────────────────────────────────────────────
export function HitTag({ cls, label }) {
  const colors = { h100: C.grn, h90: C.grn, h80: C.amb };
  const c = colors[cls] || C.amb;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
      background: `${c}18`, border: `1px solid ${c}44`, color: c,
    }}>{label}</span>
  );
}

// ── DotRow ─────────────────────────────────────────────────────
export function DotRow({ dots, color, label }) {
  return (
    <div style={{ marginBottom: 5 }}>
      {label && <div style={{ fontSize: 9, color: C.mu, marginBottom: 3 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {dots.map((d, i) => (
          <div key={i} style={{
            width: 17, height: 17, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 7, fontWeight: 700, flexShrink: 0,
            background: d ? `${color}30` : `${C.red}30`,
            border: `1px solid ${d ? color : C.red}66`,
            color: d ? color : C.red,
          }}>{d ? '✓' : '✗'}</div>
        ))}
      </div>
    </div>
  );
}

// ── BetRow ─────────────────────────────────────────────────────
export function BetRow({ label, odds }) {
  return (
    <div
      onClick={(e) => copySelection(e, `${label} @ ${odds.join(' / ')}`)}
      title="Tap to copy"
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: C.bg, borderRadius: 5, padding: '4px 8px', marginBottom: 3,
        border: `1px solid ${C.b1}`, flexWrap: 'wrap', gap: 4, ...copyableStyle,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: C.tx }}>{label}</span>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {odds.map((o, i) => (
          <span key={i} style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, padding: '2px 5px',
            borderRadius: 4, border: `1px solid ${C.b1}`, background: C.s2, color: C.tx,
          }}>{o}</span>
        ))}
        <span style={{ fontSize: 10, color: C.mu, opacity: .6 }}>⧉</span>
      </div>
    </div>
  );
}

// ── FoulCard ───────────────────────────────────────────────────
export function FoulCard({ foul }) {
  return (
    <div style={{
      background: C.s1, border: `1px solid ${foul.hot ? C.ac + '44' : C.b1}`,
      borderRadius: 8, padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 6, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{foul.name}</div>
          <div style={{ fontSize: 9, color: C.mu, marginTop: 1 }}>{foul.club}</div>
        </div>
        <HitTag cls={foul.hitClass} label={foul.hitLabel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 7 }}>
        {foul.stats.map(([l, v], i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 5, padding: '4px 6px', border: `1px solid ${C.b1}` }}>
            <div style={{ fontSize: 8, color: C.mu, textTransform: 'uppercase', letterSpacing: '.03em' }}>{l}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: C.tx }}>{v}</div>
          </div>
        ))}
      </div>

      <DotRow dots={foul.dots} color={C.grn} label="Last 10 — committed 1+ foul (✓ yes)" />
      <ConfBar label="Foul prop confidence" pct={foul.conf} color={confColor(foul.conf)} />

      {foul.bets.map((b, i) => <BetRow key={i} label={b.l} odds={b.o} />)}

      {foul.note && (
        <div style={{ fontSize: 10, color: C.mu, lineHeight: 1.6, marginTop: 6, paddingTop: 5, borderTop: `1px solid ${C.b1}` }}>
          {foul.note}
        </div>
      )}
    </div>
  );
}

// ── ShotCard ───────────────────────────────────────────────────
export function ShotCard({ shot }) {
  return (
    <div style={{
      background: C.s1, border: `1px solid ${shot.hot ? C.ac + '44' : C.b1}`,
      borderRadius: 8, padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 6, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{shot.name}</div>
          <div style={{ fontSize: 9, color: C.mu, marginTop: 1 }}>{shot.club}</div>
        </div>
        <HitTag cls={shot.hitClass} label={shot.hitLabel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 8 }}>
        {shot.stats.map(([l, v], i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 5, padding: '4px 6px', border: `1px solid ${C.b1}` }}>
            <div style={{ fontSize: 8, color: C.mu, textTransform: 'uppercase', letterSpacing: '.03em' }}>{l}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: C.tx }}>{v}</div>
          </div>
        ))}
      </div>

      <ConfBar label="Had a shot (any)" pct={shot.shotHit} color={C.ac2} />
      <ConfBar label="Shot on target"   pct={shot.sotHit}  color={C.pur} />

      <DotRow dots={shot.sdots}   color={C.ac2} label="Last 10 shots 🔵" />
      <DotRow dots={shot.sotdots} color={C.pur}  label="Last 10 SOT 🟣" />

      {shot.bets.map((b, i) => <BetRow key={i} label={b.l} odds={b.o} />)}
    </div>
  );
}

// ── AIBlock ────────────────────────────────────────────────────
export function AIBlock({ matchId, ctx }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const prompt = `WC 2026 betting analyst. Tournament averages: 24.4 fouls/game, 10.6 corners/game, 46 throw-ins/game, 3.14 goals/game, fav win rate 54%, upset rate 46%.\n\nContext: ${ctx}\n\nBullet format:\n• FOUL PROP: player, bet, confidence %, reason\n• SOT PROP: player, bet, confidence %, reason\n• CORNER BET: prop, confidence %\n• THROW-IN BET: prop, confidence %\n• LIVE TRIGGER: first 20 mins\n• RISK: biggest upset factor\n\nMax 180 words. No disclaimers.`;
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
    <div style={{ background: C.bg, border: `1px solid ${C.b1}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: C.mu }}>
          🤖 AI deep analysis
        </span>
        <button
          onClick={run}
          disabled={loading}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
            background: `${C.ac}18`, border: `1px solid ${C.ac}44`, color: C.ac, borderRadius: 5, padding: '4px 12px',
          }}
        >
          {loading ? 'Analysing…' : 'Analyse ↗'}
        </button>
      </div>
      {loading && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: '50%', background: C.ac,
              animation: `blink 1.2s ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      )}
      {result
        ? <div style={{ fontSize: 11, color: C.tx, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result}</div>
        : !loading && <div style={{ fontSize: 10, color: C.mu }}>Click Analyse for foul + SOT + corners + throw-ins + live trigger</div>}
    </div>
  );
}
