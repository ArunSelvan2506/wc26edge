import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WC_TABLE, OG_STATS } from './data.js';
import { fitFromTable } from './lib/model.js';
import { OddsToggle, Toast } from './components/Bits.jsx';
import Fixtures from './components/Fixtures.jsx';
import Standings from './components/Standings.jsx';

const VIEWS = [
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'standings', label: 'Standings' },
];

export default function App() {
  const [view, setView] = useState('fixtures');
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

      <main className="page">
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            {view === 'fixtures' && <Fixtures fmt={fmt} rat={rat} />}
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
      <p>Historical baselines and 2026 group standings come from the <b>openfootball</b> dataset (CC0). The 2026 scores are <b>seed/placeholder</b> data — illustrative, not official results. Player props are hand-curated to current World Cup starters.</p>
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
