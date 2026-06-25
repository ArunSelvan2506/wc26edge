// ─── WC26 EDGE · App.jsx ──────────────────────────────────────
// Vite + React entry point.
// Run:  npm create vite@latest . --template react
//       npm install && npm run dev
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { DATES, DAYS, TICKER } from './data';
import MatchCard from './MatchCard';
import { C } from './components';

// ── Global CSS (injected once) ────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.tx}; font-family: 'Inter', sans-serif; font-size: 13px; min-height: 100vh; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.b1}; border-radius: 2px; }
  @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,200,150,.5)} 70%{opacity:.7;box-shadow:0 0 0 8px rgba(0,200,150,0)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
`;

// ── TopBar ────────────────────────────────────────────────────
function TopBar({ liveCount }) {
  return (
    <div style={{
      background: C.s1, borderBottom: `1px solid ${C.b1}`,
      padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52, position: 'sticky', top: 0, zIndex: 300, gap: 12,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.12em', color: C.ac, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.ac, animation: 'pulse 2s infinite' }} />
        WC26 EDGE
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: 'Goals/g 3.14',   c: C.ac },
          { label: 'Fouls/g 24.4',   c: C.ac },
          { label: 'Corners/g 10.6', c: C.ac },
          { label: 'Upsets 46%',     c: C.amb },
          { label: 'Foul props 91%', c: C.red },
        ].map(({ label, c }, i) => (
          <span key={i} style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
            padding: '3px 9px', borderRadius: 4, border: '1px solid', whiteSpace: 'nowrap',
            background: `${c}10`, borderColor: `${c}40`, color: c,
          }}>{label}</span>
        ))}
        {liveCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
            padding: '3px 9px', borderRadius: 4, border: '1px solid', whiteSpace: 'nowrap',
            background: `${C.red}10`, borderColor: `${C.red}40`, color: C.red,
            animation: 'blink 1.4s infinite',
          }}>● {liveCount} LIVE</span>
        )}
      </div>
    </div>
  );
}

// ── DateNav ───────────────────────────────────────────────────
function DateNav({ active, onSelect }) {
  return (
    <nav style={{
      background: C.s1, borderBottom: `2px solid ${C.b1}`,
      padding: '0 12px', display: 'flex', alignItems: 'stretch', gap: 2,
      overflowX: 'auto', position: 'sticky', top: 52, zIndex: 200,
      scrollbarWidth: 'none',
    }}>
      {DATES.map(date => (
        <button
          key={date.k}
          onClick={() => onSelect(date.k)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minWidth: 64, padding: '8px 12px', cursor: 'pointer', border: 'none', background: 'none',
            fontFamily: 'Inter, sans-serif', flexShrink: 0, gap: 1, position: 'relative',
            borderBottom: `3px solid ${active === date.k ? C.ac : 'transparent'}`,
          }}
        >
          {date.hot && (
            <span style={{ position: 'absolute', top: 6, right: 8, width: 5, height: 5, borderRadius: '50%', background: C.ac3 }} />
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: active === date.k ? C.ac : C.mu }}>
            {date.d}
          </span>
          <span style={{ fontSize: 19, fontWeight: 800, color: active === date.k ? C.ac : C.dm }}>
            {date.n}
          </span>
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: active === date.k ? C.ac : C.dm }}>
            {date.r32 ? 'R32 begins' : date.today ? `TODAY · ${date.c}` : `${date.c} matches`}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── Ticker ────────────────────────────────────────────────────
function Ticker() {
  return (
    <div style={{
      background: C.s1, borderBottom: `1px solid ${C.b1}`,
      padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 14,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {TICKER.map(({ label, value, color }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: C.mu }}>
            {label}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color }}>
            {value}
          </span>
          {i < TICKER.length - 1 && (
            <div style={{ width: 1, height: 18, background: C.b1, marginLeft: 8 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [activeDay, setActiveDay] = useState('24');

  const day = DAYS[activeDay];
  const liveCount = Object.values(DAYS).flatMap(d => d.matches).filter(m => m.live).length;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <TopBar liveCount={liveCount} />
      <DateNav active={activeDay} onSelect={setActiveDay} />
      <Ticker />

      <main style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        {day ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: C.tx }}>{day.title}</div>
              <div style={{ fontSize: 11, color: C.mu, marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
                {day.sub}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {day.matches.map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.mu }}>
            <div style={{ fontSize: 36, opacity: .3, marginBottom: 12 }}>📅</div>
            <p>Predictions loading for this date — check back soon</p>
          </div>
        )}
      </main>

      <footer style={{
        fontSize: 9, color: C.dm, textAlign: 'center',
        padding: '14px 16px', borderTop: `1px solid ${C.b1}`, marginTop: 16, lineHeight: 1.6,
      }}>
        WC26 EDGE · React Edition · 18+ Gamble responsibly · Odds are estimates — always verify before placing ·{' '}
        <a href="https://www.begambleaware.org" style={{ color: C.ac2 }}>BeGambleAware.org</a>
      </footer>
    </>
  );
}
