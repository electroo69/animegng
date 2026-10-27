// Worker entry: /api/* is the anime API, everything else is the built site in dist/
// (unknown paths fall back to index.html via not_found_handling in wrangler.jsonc).
import { proxyApi } from './proxy.js';

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
