/* ───────────────────────────────────────────────────────────────────────────
   WC26 EDGE · Stats proxy (Cloudflare Worker)
   ───────────────────────────────────────────────────────────────────────────
   Holds your API-Football key server-side (never exposed to the browser) and
   proxies a small whitelist of read-only endpoints to the front-end, with CORS
   + edge caching so you stay well inside the free tier.

   Front-end calls:  GET <worker-url>/af/<api-football-path>
   e.g.              /af/teams?search=France
                     /af/players?team=2&season=2025

   Deploy: see stats-proxy/README.md
   ─────────────────────────────────────────────────────────────────────────── */

const UPSTREAM = 'https://v3.football.api-sports.io';

// Only these API-Football paths may be proxied (read-only, stats/squads/odds).
const ALLOW = [/^teams\b/, /^players\b/, /^players\/squads\b/, /^fixtures\b/, /^fixtures\/statistics\b/, /^odds\b/];

// Allow your site origins to call the worker. Add your custom domain if any.
const ALLOWED_ORIGINS = [
  'https://arunselvan2506.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
];

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors(origin) });

    const url = new URL(request.url);
    const m = url.pathname.match(/^\/af\/(.+)$/);
    if (!m) return new Response(JSON.stringify({ error: 'use /af/<path>' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

    const path = m[1];
    if (!ALLOW.some(re => re.test(path))) {
      return new Response(JSON.stringify({ error: 'path not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
    }

    const target = `${UPSTREAM}/${path}${url.search}`;
    // Edge cache: stats change slowly, cache 6h to protect the free-tier quota.
    const cacheKey = new Request(target, request);
    const cache = caches.default;
    let res = await cache.match(cacheKey);
    if (!res) {
      const upstream = await fetch(target, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
      res = new Response(upstream.body, upstream);
      res.headers.set('Cache-Control', 'public, max-age=21600'); // 6h
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    const out = new Response(res.body, res);
    Object.entries(cors(origin)).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};
