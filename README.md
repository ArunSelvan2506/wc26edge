# WC26 EDGE · React Source

Private World Cup 2026 prediction hub — React + Vite edition.

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/wc26edge/`

## Build & deploy

```bash
npm run build
# uploads dist/ to Netlify Drop: netlify.com/drop
# or push to GitHub Pages branch
```

## File structure

```
src/
  App.jsx         ← Root component: TopBar, DateNav, Ticker, page layout
  MatchCard.jsx   ← Clickable match card with 5 tabs (Result/Fouls/Shots/Easy/Parlay)
  components.jsx  ← ConfBar, FoulCard, ShotCard, AIBlock, DotRow, HitTag, BetRow
  data.js         ← All fixture + player data (edit here to update predictions)
  main.jsx        ← React DOM entry point
index.html        ← Vite HTML shell
vite.config.js    ← base path set to /wc26edge/
package.json
```

## Updating predictions

All match and player data lives in `src/data.js`. To update:

1. Open `src/data.js`
2. Find the match by `id` inside the relevant `DAYS['DD']` block
3. Edit `odds`, `conf`, `upset`, `cbars`, `fouls`, `shots`, `easy`, `parlay` fields
4. Save → Vite hot-reloads instantly

## Lineup integration

The AI analysis button in the Parlay + AI tab calls `claude-sonnet-4-6` directly.
For live lineup integration add API-Football polling in `src/lineup.js` and
import into `MatchCard.jsx` — see `wc2026_edge_react.jsx` for the full hook.

## Live site

https://arunselvan2506.github.io/wc26edge/

---

18+ · Gamble responsibly · BeGambleAware.org
