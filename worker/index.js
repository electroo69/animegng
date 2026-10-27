// Worker entry: /api/* is the anime API, everything else is the built site in dist/
// (unknown paths fall back to index.html via not_found_handling in wrangler.jsonc).
import { handle } from './app.js';

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handle(request, url.pathname.slice(4) || '/', ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
