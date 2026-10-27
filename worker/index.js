// Worker entry: /api/* is the anime API; page routes, robots/llms/sitemaps get edge SEO
// (seo.js); everything else is the built site in dist/ (SPA fallback via wrangler.jsonc).
import { proxyApi } from './proxy.js';
import { handleSeo } from './seo.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env, ctx);
    }
    const seo = await handleSeo(request, env, ctx, () => env.ASSETS.fetch(new URL('/', request.url)));
    return seo ?? env.ASSETS.fetch(request);
  },
};
