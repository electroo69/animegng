// Every request passes through here first: page routes, robots.txt, llms.txt and sitemaps get
// server-rendered SEO (worker/seo.js); everything else (assets, /api) continues unchanged.
import { handleSeo } from '../worker/seo.js';

// The production pages.dev host permanently redirects to the custom domain so search engines
// consolidate on one address. Preview deployments (<hash>.animegng.pages.dev) and /api are left alone.
const CANONICAL_HOST = 'animegng.com';
const LEGACY_HOST = 'animegng.pages.dev';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.hostname === LEGACY_HOST && !url.pathname.startsWith('/api') && (request.method === 'GET' || request.method === 'HEAD')) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }
  const res = await handleSeo(request, env, context, () => env.ASSETS.fetch(new URL('/', request.url)));
  return res ?? context.next();
}
