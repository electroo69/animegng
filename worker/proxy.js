import { storedServers, directWatch } from './direct-embeds.js';
import { handle } from './app.js';

// Only the public read-only anime API is forwarded to the configured backend.
export async function proxyApi(request, env, ctx) {
  if (!['GET', 'OPTIONS'].includes(request.method)) {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } });
  }
  const incoming = new URL(request.url);
  // Manga is served here on Cloudflare: WeebCentral answers Vercel's servers with 403 but not Cloudflare's.
  if (incoming.pathname.startsWith('/api/manga/')) return handle(request, incoming.pathname.slice(4), ctx);
  const target = new URL(env.API_ORIGIN || 'https://animegng-api.vercel.app');
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const cache = globalThis.caches?.default;
  const key = new Request(incoming, { method: 'GET' });
  if (request.method === 'GET') {
    const hit = await cache?.match(key);
    if (hit) return hit;
  }
  try {
    const match = incoming.pathname.match(/^\/api\/(watch|servers)\/(\d+)\/(\d+)\/?$/);
    const mapped = request.method === 'GET' && match ? await storedServers(match[2], match[3], incoming.origin) : null;
    if (mapped) {
      const data = match[1] === 'servers' ? mapped
        : await directWatch(Number(match[2]), Number(match[3]), target.origin, mapped);
      return Response.json(data, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
    }
    const upstream = await fetch(target, { method: request.method, headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(55000), redirect: 'manual' });
    if (request.method !== 'OPTIONS' && !upstream.headers.get('Content-Type')?.includes('application/json')) {
      throw new Error('API returned a non-JSON response');
    }
    const response = new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    if (!response.ok) response.headers.set('Cache-Control', 'no-store');
    if (request.method === 'GET' && response.ok && cache && !response.headers.get('Cache-Control')?.includes('no-store')) ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ event: 'api_proxy_error', path: incoming.pathname, message: error.message }));
    return Response.json({ error: 'The anime API is temporarily unavailable. Please try again.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

