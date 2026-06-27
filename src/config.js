// Live stats integration (API-Football via your Cloudflare proxy).
//
// Set the proxy URL either at BUILD time or at RUNTIME — whichever is easier:
//   • Build:   VITE_STATS_PROXY=https://wc26-stats.you.workers.dev npm run build
//   • Runtime: localStorage.setItem('wc_stats_proxy','https://…workers.dev') then reload
//
// While unset, the whole live layer is a no-op and curated props show. See
// stats-proxy/README.md to deploy the proxy + free API-Football key.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
function ls(k) { try { return (localStorage.getItem(k) || '').trim(); } catch { return ''; } }

export const STATS_PROXY = String(env.VITE_STATS_PROXY || ls('wc_stats_proxy') || '').replace(/\/+$/, '');
export const SEASON = Number(env.VITE_AF_SEASON || ls('wc_af_season') || 2025);
