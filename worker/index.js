// Worker entry: /api/u/* is the account & community API (D1 + watch-party Durable Objects),
// /api/* is the anime API; page routes, robots/llms/sitemaps get edge SEO (seo.js); everything
// else is the built site in dist/ (SPA fallback via wrangler.jsonc).
import { proxyApi } from './proxy.js';
import { handleSeo } from './seo.js';
import { handleSocial } from './social/api.js';
import { notifyNewEpisodes } from './social/cron.js';

export { PartyRoom } from './social/room.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/u/')) return handleSocial(request, env, url.pathname.slice(6));
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env, ctx);
    }
    // Nothing lives under /.well-known/ yet; answer 404 rather than letting the SPA fallback serve HTML.
    if (url.pathname.startsWith('/.well-known/')) return new Response('Not found', { status: 404 });
    const seo = await handleSeo(request, env, ctx, () => env.ASSETS.fetch(new URL('/', request.url)));
    return seo ?? env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(notifyNewEpisodes(env));
  },
};
