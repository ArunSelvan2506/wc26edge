import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WC_TABLE, OG_STATS, CRICKET } from './data.js';
import { fitFromTable } from './lib/model.js';
import { ZONES, dayKeyIn, dayLabelIn } from './lib/tz.js';
import { SPORT_CFG } from './data/sports.js';
import { OddsToggle, Toast } from './components/Bits.jsx';
import Fixtures from './components/Fixtures.jsx';
import Standings from './components/Standings.jsx';
import Cricket from './components/Cricket.jsx';
import SportView from './components/SportView.jsx';

// Distinct fixture days for a sport, in the chosen timezone, for the date pill.
function daysForSport(sport, tz) {
  const out = new Map();
  const add = (utc, fallback) => {
    if (utc != null) { const k = dayKeyIn(utc, tz); if (k && !out.has(k)) out.set(k, dayLabelIn(utc, tz)); }
    else if (fallback) { const k = 'd:' + fallback; if (!out.has(k)) out.set(k, fallback.replace(/\s*\(IST\)/, '')); }
  };
  if (sport === 'cricket') { for (const b of (CRICKET.blocks || [])) for (const m of b.matches) add(m.utc, b.date); }
  else if (sport === 'tennis' || sport === 'basketball') { for (const ev of (SPORT_CFG[sport]?.events || [])) add(ev.utc, ev.date); }
  return [...out.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([key, label]) => ({ key, label }));
}

const VIEWS = [
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'standings', label: 'Standings' },
];

// Top-level sport groups. Football (World Cup 2026) is live; the rest are
// scaffolded — drop in their data + views to bring them online.
const SPORTS = [
  { id: 'football', label: 'Football', icon: '⚽', live: true, tag: 'World Cup 2026' },
  { id: 'cricket', label: 'Cricket', icon: '🏏', live: true, tag: 'Internationals' },
  { id: 'tennis', label: 'Tennis', icon: '🎾', live: true, tag: 'ATP/WTA' },
  { id: 'basketball', label: 'Basketball', icon: '🏀', live: true, tag: 'NBA' },
  { id: 'f1', label: 'Formula 1', icon: '🏎️', live: true, tag: 'F1' },
];

export default function App() {
  const [sport, setSport] = useState(null);   // null = home / sport picker
  const [view, setView] = useState('fixtures');
  const [fmt, setFmt] = useState(() => {
    try { const f = localStorage.getItem('wc_oddsfmt'); return f === 'dec' ? 'dec' : 'frac'; } catch { return 'frac'; }
  });
  const [tz, setTz] = useState(() => {
    try { return localStorage.getItem('wc_tz') || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
  });
  const [dateSel, setDateSel] = useState('all');
  const rat = useMemo(() => fitFromTable(WC_TABLE), []);

  const changeFmt = f => { setFmt(f); try { localStorage.setItem('wc_oddsfmt', f); } catch { /* ignore */ } };
  const changeTz = z => { setTz(z); try { localStorage.setItem('wc_tz', z); } catch { /* ignore */ } setDateSel('all'); };
  const pick = id => { setSport(id); setView('fixtures'); setDateSel('all'); };
  const days = sport ? daysForSport(sport, tz) : [];

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
    }
  }, []);

  return (
    <>
      <div className={'backdrop' + (sport === 'football' ? '' : ' plain')} />
      <div className="backdrop-glow" />

      <header className="topbar">
        <button className="logo" onClick={() => { setSport(null); setView('fixtures'); }} aria-label="Home" type="button">
          <Trophy />
          <span className="logo-dot" />
          PREDICTION HUB
        </button>
        {sport && (
          <div className="topbar-actions">
            {days.length > 1 && (
              <select className="pill-sel" value={dateSel} onChange={e => setDateSel(e.target.value)} aria-label="Date">
                <option value="all">All days</option>
                {days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            )}
            <select className="pill-sel" value={tz} onChange={e => changeTz(e.target.value)} aria-label="Timezone">
              {ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
            <OddsToggle fmt={fmt} onChange={changeFmt} />
            {sport === 'football' && (
              <nav style={{ display: 'flex', gap: 5 }}>
                {VIEWS.map(v => (
                  <button key={v.id} className={'nav-btn' + (view === v.id ? ' active' : '')} onClick={() => setView(v.id)}>{v.label}</button>
                ))}
              </nav>
            )}
          </div>
        )}
      </header>

      {sport && (
        <nav className="sport-nav">
          {SPORTS.map(s => (
            <button key={s.id} type="button"
              className={'sport-btn' + (sport === s.id ? ' active' : '') + (s.live ? '' : ' soon')}
              onClick={() => pick(s.id)}>
              <span className="sport-ico">{s.icon}</span>
              <span className="sport-lb">{s.label}</span>
              {!s.live && <span className="sport-tag">Soon</span>}
            </button>
          ))}
        </nav>
      )}

      <main className="page">
        <AnimatePresence mode="wait">
          <motion.div key={(sport || 'home') + view}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            {!sport
              ? <SportPicker onPick={pick} />
              : sport === 'cricket'
                ? <Cricket fmt={fmt} tz={tz} dateSel={dateSel} />
                : (sport === 'tennis' || sport === 'basketball' || sport === 'f1')
                  ? <SportView sportId={sport} fmt={fmt} tz={tz} dateSel={dateSel} />
                  : <>
                      {view === 'fixtures' && <Fixtures fmt={fmt} rat={rat} tz={tz} />}
                      {view === 'standings' && <Standings />}
                      {view === 'about' && <About />}
                    </>}
          </motion.div>
        </AnimatePresence>

        <div className="disc">
          Prediction Hub · a private hub for entertainment. Odds and model outputs are calibrated estimates, not guarantees. Bet responsibly.
        </div>
      </main>

      <Toast />
    </>
  );
}

function SportPicker({ onPick }) {
  return (
    <div className="picker">
      <div className="picker-h">Pick a sport</div>
      <div className="picker-sub">Model picks, odds, props &amp; value parlays — choose where to start.</div>
      <div className="picker-grid">
        {SPORTS.map((s, i) => (
          <motion.button key={s.id} type="button" className="picker-card" onClick={() => onPick(s.id)}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3), ease: 'easeOut' }}
            whileTap={{ scale: 0.97 }}>
            <span className="picker-ico">{s.icon}</span>
            <span className="picker-name">{s.label}</span>
            <span className="picker-tag">{s.tag}</span>
            <span className="picker-go">Open →</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ComingSoon({ sport }) {
  return (
    <div className="coming-soon">
      <div className="cs-ico">{sport.icon}</div>
      <h3>{sport.label} · coming soon</h3>
      <p>The prediction engine is being extended to {sport.label}. Fixtures, the probability model and value parlays will land here next.</p>
      <span className="cs-pill">In the works</span>
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
