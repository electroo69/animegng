// Every request passes through here first: page routes, robots.txt, llms.txt and sitemaps get
// server-rendered SEO (worker/seo.js); everything else (assets, /api) continues unchanged.
import { handleSeo } from '../worker/seo.js';

// The production pages.dev host permanently redirects to the custom domain so search engines
// consolidate on one address. Preview deployments (<hash>.animegng.pages.dev) and /api are left alone.
const CANONICAL_HOST = 'animegng.com';
const LEGACY_HOST = 'animegng.pages.dev';

// Accounts, comments, likes and watch parties live in the Worker (D1 + Durable Objects). Forward
// /api/u/* there, WebSocket upgrades included, so session cookies stay on this domain.
const SOCIAL_ORIGIN = 'https://animegng.drop-share-free.workers.dev';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/u/')) {
    const fwd = new Request(`${env.SOCIAL_ORIGIN || SOCIAL_ORIGIN}${url.pathname}${url.search}`, request);
    // The Worker trusts this IP (for rate limits) only alongside the shared secret.
    fwd.headers.set('X-AG-Client-IP', request.headers.get('CF-Connecting-IP') || '');
    if (env.PROXY_SECRET) fwd.headers.set('X-AG-Proxy', env.PROXY_SECRET);
    return fetch(fwd, { redirect: 'manual' });
  }
  if (url.hostname === LEGACY_HOST && !url.pathname.startsWith('/api') && (request.method === 'GET' || request.method === 'HEAD')) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }
  // Nothing lives under /.well-known/ yet; answer 404 rather than letting the SPA fallback serve HTML.
  if (url.pathname.startsWith('/.well-known/')) return new Response('Not found', { status: 404 });
  const res = await handleSeo(request, env, context, () => env.ASSETS.fetch(new URL('/', request.url)));
  return res ?? context.next();
}
