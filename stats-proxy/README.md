# WC26 EDGE · Stats proxy + in-form logic

This adds **live in-form player selection** (shot & foul markets) driven by real
recent form from [API-Football](https://www.api-football.com/), without exposing
your API key. A Cloudflare Worker holds the key and proxies a small read-only
whitelist; the front-end ranks in-form, in-squad players and surfaces them in the
Shots / Fouls tabs and parlays.

Until you complete the steps below, the site behaves exactly as before (the
in-form engine is a no-op when `STATS_PROXY` is empty).

## 1. Get an API-Football key
- Sign up at https://dashboard.api-football.com/ (free tier ≈ 100 req/day — the
  worker caches 6h so this is plenty for a prediction hub).
- Copy your key (`x-apisports-key`).

## 2. Deploy the Worker
```bash
npm i -g wrangler
cd stats-proxy
wrangler login
wrangler deploy worker.js --name wc26-stats
wrangler secret put API_FOOTBALL_KEY      # paste your key when prompted
```
This prints a URL like `https://wc26-stats.<you>.workers.dev`.

- Edit `ALLOWED_ORIGINS` in `worker.js` if your site isn't on
  `arunselvan2506.github.io`, then redeploy.

## 3. Point the site at the proxy
In `index.html`, set:
```js
const STATS_PROXY = 'https://wc26-stats.<you>.workers.dev';
```
Commit + deploy. Open a match → the **Shots** and **Fouls** tabs show a
**🔥 LIVE IN-FORM** strip with the current top players by recent shots-on-target
and fouls committed, and the top in-form shooter is suggested for the parlay.

## How the logic works (all fixtures)
- `teams?search=<country>` → team id (cached in `localStorage`).
- **World Cup / international STARTERS first:** `fixtures?team=<id>&last=6` →
  `fixtures/lineups?fixture=<fid>&team=<id>` for each → count who appears in the
  **starting XI**. A player must have started ≥2 of the last ~6 national-team
  games. This is why a club regular who's a national-team benchwarmer
  (e.g. Rúben Neves) is excluded. If lineups can't be resolved, it falls back to
  the club-start heuristic (`games.lineups` ≥3 and ≥50% of appearances).
- `players?team=<id>&season=<SEASON>` supplies each starter's shot/foul numbers.
- **Shot market:** among starters, rank by shots-on-target (then total shots).
- **Foul market:** among starters, rank by fouls committed — and a foul prop is
  **guaranteed**: if foul data is missing, the most-used central starter
  (mid/def) is shown, so every match always has at least one foul prop.
- ⚠️ Cost: the lineup lookups add ~7 calls per team (1 fixtures + ~6 lineups),
  all cached 6h. On the free tier keep an eye on the daily quota; bump the
  Worker cache TTL or upgrade the plan if you open many fixtures per day.
- When active, the Shots / Fouls tabs are **replaced** with live in-form starter
  cards (name, position, shots/SOT or fouls, and "starts X/Y"). Curated data is
  shown only when the proxy is unset or a call fails.
- Corners / throw-ins remain **team** markets; they can be fed later from
  `fixtures/statistics` (team corners over last N) — see TODO in `index.html`.

## Notes
- The free tier exposes **club-season** stats (recent club form). For
  national-team / WC-qualifier form, set `SEASON`/league params per your plan.
- Everything fails safe: if the proxy is down or a team can't be resolved, the
  curated data is shown instead.
