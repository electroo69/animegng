// Every request passes through here first: page routes, robots.txt, llms.txt and sitemaps get
// server-rendered SEO (worker/seo.js); everything else (assets, /api) continues unchanged.
import { handleSeo } from '../worker/seo.js';

export async function onRequest(context) {
  const { request, env } = context;
  const res = await handleSeo(request, env, context, () => env.ASSETS.fetch(new URL('/', request.url)));
  return res ?? context.next();
}
