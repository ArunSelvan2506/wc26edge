import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DATES, DAYS, WC_TABLE, OG_STATS } from './data.js';
import { fitFromTable } from './lib/model.js';
import { OddsToggle, Toast } from './components/Bits.jsx';
import MatchCard from './components/MatchCard.jsx';
import Standings from './components/Standings.jsx';

const VIEWS = [
  { id: 'matches', label: 'Matches' },
  { id: 'standings', label: 'Standings' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const firstKey = (DATES.find(d => DAYS[d.key]) || DATES[0]).key;
  const [view, setView] = useState('matches');
  const [dayKey, setDayKey] = useState(firstKey);
  const [fmt, setFmt] = useState(() => {
    try { return localStorage.getItem('wc_oddsfmt') || 'frac'; } catch { return 'frac'; }
  });
  const rat = useMemo(() => fitFromTable(WC_TABLE), []);

  const changeFmt = f => { setFmt(f); try { localStorage.setItem('wc_oddsfmt', f); } catch { /* ignore */ } };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
    }
  }, []);

  return (
    <>
      <div className="backdrop" />
      <div className="backdrop-glow" />

      <header className="topbar">
        <div className="logo">
          <Trophy />
          <span className="logo-dot" />
          WC26 EDGE
        </div>
        <div className="topbar-actions">
          <OddsToggle fmt={fmt} onChange={changeFmt} />
          <nav style={{ display: 'flex', gap: 5 }}>
            {VIEWS.map(v => (
              <button key={v.id} className={'nav-btn' + (view === v.id ? ' active' : '')} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </nav>
        </div>
      </header>

      {view === 'matches' && (
        <nav className="date-nav">
          {DATES.map(d => (
            <button key={d.key} className={'dn-btn' + (d.key === dayKey ? ' active' : '')} onClick={() => setDayKey(d.key)}>
              {d.hot && <span className="hot-dot" />}
              <span className="dn-day">{d.day}</span>
              <span className="dn-num">{d.num}</span>
              <span className="dn-cnt">{d.r32 ? 'R32' : d.cnt + ' gm'}</span>
            </button>
          ))}
        </nav>
      )}

      <main className="page">
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            {view === 'matches' && <MatchesView dayKey={dayKey} fmt={fmt} rat={rat} />}
            {view === 'standings' && <Standings />}
            {view === 'about' && <About />}
          </motion.div>
        </AnimatePresence>

        <div className="disc">
          WC26 EDGE · a private prediction hub for entertainment. Odds are estimates/illustrative; 2026 results use the openfootball seed dataset and are not official. Model outputs are calibrated estimates, not guarantees. Bet responsibly.
        </div>
      </main>

      <Toast />
    </>
  );
}

function MatchesView({ dayKey, fmt, rat }) {
  const day = DAYS[dayKey];
  if (!day) {
    const d = DATES.find(x => x.key === dayKey);
    return (
      <div className="no-matches">
        <div style={{ fontFamily: 'var(--disp)', fontSize: 20, color: 'var(--mu)' }}>{d?.r32 ? 'Round of 32' : 'Fixtures'}</div>
        <p style={{ marginTop: 8 }}>Fixtures are set once the group stage completes.</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="day-title">{day.title}</h1>
      <div className="day-sub">{day.sub}</div>
      <div className="matches">
        {day.matches.map((m, i) => <MatchCard key={m.id} m={m} fmt={fmt} rat={rat} index={i} />)}
      </div>
    </div>
  );
}

function About() {
  const b = OG_STATS.baseline;
  return (
    <div className="about">
      <h3>What this is</h3>
      <p><b>WC26 EDGE</b> is a private World Cup 2026 prediction hub — match results, player foul &amp; shot props, easy bets, value parlays, and a probability model, all in one place. Built mobile-first as an installable web app.</p>
      <h3>The model</h3>
      <p>The 📊 Model tab runs an <b>opponent-adjusted Poisson / Dixon-Coles</b> engine: it fits attack/defense strengths from tournament results, regularised toward the historical World Cup baseline (<code>{b.goalsPerGame} goals/game</code>), then derives 1X2 / Over 2.5 / BTTS probabilities. It de-vigs the market to a fair price and flags <b>value</b> with expected-value and quarter-Kelly staking.</p>
      <p>A leave-one-out backtest (Brier / log-loss / reliability) keeps it honest: on the current seed data it beats base rates on BTTS and is roughly baseline on 1X2 / Over — so goals-market “value” is shown with caution. Real edge needs deeper match history, which live data unlocks.</p>
      <h3>Data</h3>
      <p>Historical baselines and 2026 group standings come from the <b>openfootball</b> dataset (CC0). The 2026 scores are <b>seed/placeholder</b> data — illustrative, not official results. Player props are hand-curated to current World Cup starters; live per-player form can be wired via an API-Football proxy.</p>
      <h3>Using it</h3>
      <p>Tap any pick or odds to copy it. Switch odds between fractional, decimal and American up top. Install to your home screen for a full-screen app. <b>For entertainment only — bet responsibly.</b></p>
    </div>
  );
}

function Trophy() {
  return (
    <svg className="logo-mark" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v3c0 4-3 6-6 6S6 11 6 7V4Z" fill="#2dc8a0" fillOpacity="0.85" />
      <path d="M6 5C3.5 5.3 3.5 9 7 10M18 5c2.5.3 2.5 4-1 5" stroke="#2dc8a0" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M10.5 13h3l-.4 4h-2.2l-.4-4Z" fill="#2dc8a0" fillOpacity="0.85" />
      <rect x="8" y="18" width="8" height="2" rx="0.6" fill="#2dc8a0" />
    </svg>
  );
}
