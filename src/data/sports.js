// Curated multi-sport data (illustrative — not official). Ratings drive the
// model; form / props / injuries are hand-seeded ("AI-curated"). Props list
// robust last-10 hit counts. All odds shown are model-fair.

export const TENNIS = {
  id: 'tennis', kind: 'h2h', label: 'ATP/WTA', spread: 190,
  roster: {
    'Jannik Sinner': { r: 2060, form: ['W', 'W', 'W', 'L', 'W'], inj: null, props: [
      { m: 'aces', line: 'Over 8.5', last10: 8, am: '-120' },
      { m: 'total games', line: 'Over 22.5', last10: 7, am: '-105' },
      { m: 'to drop a set', line: '', last10: 3, am: '+450' },
    ] },
    'Carlos Alcaraz': { r: 2035, form: ['W', 'L', 'W', 'W', 'W'], inj: null, props: [
      { m: 'aces', line: 'Over 6.5', last10: 8, am: '-130' },
      { m: 'to win a set', line: '', last10: 10, am: '-650' },
      { m: 'to win 6-0 a set', line: '', last10: 2, am: '+550' },
    ] },
    'Alexander Zverev': { r: 1955, form: ['W', 'W', 'L', 'W', 'L'], inj: 'minor ankle (probable)', props: [
      { m: 'aces', line: 'Over 9.5', last10: 7, am: '-115' },
    ] },
    'Daniil Medvedev': { r: 1930, form: ['L', 'W', 'L', 'W', 'W'], inj: null, props: [
      { m: 'total games', line: 'Over 21.5', last10: 7, am: '-110' },
    ] },
    'Iga Świątek': { r: 2010, form: ['W', 'W', 'W', 'W', 'L'], inj: null, props: [
      { m: 'to win a set', line: '', last10: 9, am: '-500' },
    ] },
    'Aryna Sabalenka': { r: 1980, form: ['W', 'L', 'W', 'W', 'W'], inj: null, props: [
      { m: 'aces', line: 'Over 4.5', last10: 8, am: '-125' },
    ] },
  },
  events: [
    { utc: '2026-06-28T13:00:00Z', date: 'Sun 28 Jun', series: 'Wimbledon · Round of 16', matches: [
      { a: 'Jannik Sinner', b: 'Daniil Medvedev', label: 'ATP' },
      { a: 'Carlos Alcaraz', b: 'Alexander Zverev', label: 'ATP' },
      { a: 'Iga Świątek', b: 'Aryna Sabalenka', label: 'WTA' },
    ] },
  ],
};

export const NBA = {
  id: 'basketball', kind: 'h2h', label: 'NBA', spread: 95,
  roster: {
    'Boston Celtics': { r: 1660, form: ['W', 'W', 'W', 'L', 'W'], inj: 'K. Porziņģis (Q)', props: [
      { player: 'J. Tatum', m: 'points', line: 'Over 27.5', last10: 7, am: '-115' },
      { player: 'J. Brown', m: 'points', line: 'Over 24.5', last10: 7, am: '-110' },
    ] },
    'New York Knicks': { r: 1585, form: ['L', 'W', 'W', 'L', 'W'], inj: null, props: [
      { player: 'J. Brunson', m: 'points', line: 'Over 28.5', last10: 8, am: '-120' },
      { player: 'J. Brunson', m: 'points', line: 'Over 39.5', last10: 2, am: '+600' },
    ] },
    'Denver Nuggets': { r: 1640, form: ['W', 'W', 'L', 'W', 'W'], inj: null, props: [
      { player: 'N. Jokić', m: 'triple-double', line: '', last10: 7, am: '+105' },
      { player: 'N. Jokić', m: 'rebounds', line: 'Over 11.5', last10: 8, am: '-115' },
    ] },
    'Minnesota T-Wolves': { r: 1600, form: ['W', 'L', 'W', 'W', 'L'], inj: 'R. Gobert (Q)', props: [
      { player: 'A. Edwards', m: 'points', line: 'Over 26.5', last10: 7, am: '-110' },
      { player: 'A. Edwards', m: 'points', line: 'Over 39.5', last10: 2, am: '+500' },
    ] },
    'OKC Thunder': { r: 1655, form: ['W', 'W', 'W', 'W', 'L'], inj: null, props: [
      { player: 'S. Gilgeous-Alexander', m: 'points', line: 'Over 30.5', last10: 8, am: '-115' },
    ] },
    'Dallas Mavericks': { r: 1595, form: ['L', 'W', 'L', 'W', 'W'], inj: 'L. Dončić (probable)', props: [
      { player: 'L. Dončić', m: 'assists', line: 'Over 8.5', last10: 7, am: '-120' },
    ] },
  },
  events: [
    { utc: '2026-06-28T13:00:00Z', date: 'Sun 28 Jun', series: 'NBA · Regular season', matches: [
      { a: 'Boston Celtics', b: 'New York Knicks', total: 218.5, totalProb: 0.56, totalAm: '-110' },
      { a: 'Denver Nuggets', b: 'Minnesota T-Wolves', total: 224.5, totalProb: 0.53, totalAm: '-110' },
      { a: 'OKC Thunder', b: 'Dallas Mavericks', total: 229.5, totalProb: 0.58, totalAm: '-108' },
    ] },
  ],
};

import { F1_LIVE } from '../data.js';

// Curated driver props (finish/podium markets) keyed by full name — attached on
// top of whichever grid (live or fallback) is in use.
const F1_PROPS = {
  'Max Verstappen': [{ m: 'finish', line: 'Top 6', last10: 10, am: '-600' }, { m: 'fastest lap', line: '', last10: 4, am: '+260' }],
  'Lando Norris': [{ m: 'finish', line: 'Top 6', last10: 9, am: '-450' }],
  'Oscar Piastri': [{ m: 'finish', line: 'Top 6', last10: 9, am: '-400' }],
  'Charles Leclerc': [{ m: 'finish', line: 'Top 8', last10: 9, am: '-350' }],
};

const F1_FALLBACK = {
  id: 'f1', kind: 'race', label: 'Formula 1', tauWin: 6.5, tauPod: 12,
  drivers: {
    'Max Verstappen': { r: 97, team: 'Red Bull', form: ['1', '1', '2', '1', '3'], inj: null, props: [
      { m: 'finish', line: 'Top 6', last10: 10, am: '-600' }, { m: 'fastest lap', line: '', last10: 4, am: '+260' },
    ] },
    'Lando Norris': { r: 93, team: 'McLaren', form: ['2', '1', '1', '3', '2'], inj: null, props: [
      { m: 'finish', line: 'Top 6', last10: 9, am: '-450' },
    ] },
    'Oscar Piastri': { r: 92, team: 'McLaren', form: ['1', '3', '2', '2', '4'], inj: null, props: [
      { m: 'finish', line: 'Top 6', last10: 9, am: '-400' },
    ] },
    'Charles Leclerc': { r: 89, team: 'Ferrari', form: ['3', '4', '2', '5', '1'], inj: null, props: [
      { m: 'finish', line: 'Top 8', last10: 9, am: '-350' },
    ] },
    'Lewis Hamilton': { r: 86, team: 'Ferrari', form: ['4', '5', '6', '3', '4'], inj: null, props: [] },
    'George Russell': { r: 85, team: 'Mercedes', form: ['5', '2', '4', '6', '5'], inj: null, props: [] },
    'Carlos Sainz': { r: 82, team: 'Williams', form: ['6', '7', '5', '8', '6'], inj: null, props: [] },
    'Fernando Alonso': { r: 80, team: 'Aston Martin', form: ['8', '6', '9', '7', '10'], inj: 'back niggle (fit)', props: [] },
  },
  events: [
    { date: 'Mon 29 Jun (IST)', series: 'British GP · Silverstone',
      field: ['Max Verstappen', 'Lando Norris', 'Oscar Piastri', 'Charles Leclerc', 'Lewis Hamilton', 'George Russell', 'Carlos Sainz', 'Fernando Alonso'] },
  ],
};

// Prefer live current-season standings (Jolpica, baked hourly); fall back to the
// curated grid. Curated props are attached to matching drivers either way.
function buildF1() {
  if (F1_LIVE && F1_LIVE.drivers && Object.keys(F1_LIVE.drivers).length && F1_LIVE.event?.field?.length) {
    const drivers = {};
    for (const [name, d] of Object.entries(F1_LIVE.drivers)) drivers[name] = { ...d, props: F1_PROPS[name] || [] };
    return {
      id: 'f1', kind: 'race', label: 'Formula 1', tauWin: 11, tauPod: 18,
      live: true, season: F1_LIVE.season,
      drivers,
      events: [{ date: F1_LIVE.event.date, series: F1_LIVE.event.series, field: F1_LIVE.event.field }],
    };
  }
  return F1_FALLBACK;
}

export const F1 = buildF1();
export const SPORT_CFG = { tennis: TENNIS, basketball: NBA, f1: F1 };
