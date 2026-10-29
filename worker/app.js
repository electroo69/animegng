// The anime API (AniList + ani.zip + Jikan, plus reanime's /api/flix for video servers) as a
// Cloudflare Worker (see worker/index.js). Ported from "api without reanime/server.js": same routes and shapes,
// served under /api on the site's own domain.
import * as src from './sources.js';
import * as manga from './manga.js';

const MIN = 60_000;

// In-memory cache with per-route TTL so we stay well under AniList's rate limit.
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = fn();
  cache.set(key, { pending, expires: 0 });
  try {
    const value = await pending;
    cache.set(key, { value, expires: Date.now() + ttl });
    if (cache.size > 3000) cache.delete(cache.keys().next().value);
    return value;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const detail = (id) => cached(`detail:${id}`, 30 * MIN, () => src.animeDetail(id));
const mapping = (id) => cached(`anizip:${id}`, 60 * MIN, () => src.anizip(id));

// Jikan filler/recap flags load in the background so a slow Jikan never blocks a response.
const fillerFlags = new Map(); // malId -> flags object, once loaded
function flagsFor(malId, ctx) {
  if (!malId) return null;
  if (fillerFlags.has(malId)) return fillerFlags.get(malId);
  fillerFlags.set(malId, null);
  // Workers cancel unawaited work once the response is sent, so keep the isolate alive for it.
  ctx.waitUntil(src.jikanFlags(malId).then((f) => {
    if (Object.keys(f).length) fillerFlags.set(malId, f);
    else fillerFlags.delete(malId); // retry on a later request
  }));
  return null;
}

/** Merged episode list: ani.zip (titles, stills, synopsis) + Jikan (filler/recap) + AniList (counts). */
async function episodes(id, ctx) {
  const key = `episodes:${id}`;
  // Rebuild once filler flags arrive, so they show up without waiting for the TTL.
  const hit = cache.get(key);
  if (hit?.value && !hit.value.sources.filler && fillerFlags.get(hit.value.mal_id)) cache.delete(key);
  return cached(key, 30 * MIN, async () => {
    const [a, z] = await Promise.all([detail(id), mapping(id).catch(() => null)]);
    const flags = flagsFor(a.mal_id, ctx) ?? {};
    const zeps = z?.episodes ?? {};
    // How many episodes exist so far: aired count for airing shows, total otherwise.
    const aired = a.next_airing_episode ? a.next_airing_episode.episode - 1 : null;
    const numericKeys = Object.keys(zeps).filter((k) => /^\d+$/.test(k)).map(Number);
    const count = aired ?? a.episodes ?? (numericKeys.length ? Math.max(...numericKeys) : 0);

    const list = [];
    for (let n = 1; n <= count; n++) {
      const e = zeps[n] ?? {};
      const f = flags[n] ?? {};
      list.push({
        episode_number: n,
        title: e.title?.en || f.mal_title || e.title?.['x-jat'] || `Episode ${n}`,
        title_japanese: e.title?.ja ?? null,
        title_romaji: e.title?.['x-jat'] ?? null,
        description: e.overview || e.summary || null,
        aired: e.airDateUtc || e.airdate || null,
        duration: e.runtime || e.length || a.duration || null,
        thumbnail: e.image || null,
        rating: e.rating ? Number(e.rating) : null,
        is_filler: f.is_filler ?? null,
        is_recap: f.is_recap ?? null,
        tvdb_id: e.tvdbId ?? null,
        anidb_id: e.anidbEid ?? null,
      });
    }
    return {
      anime_id: a.id,
      mal_id: a.mal_id,
      total: list.length,
      total_planned: a.episodes,
      next_airing_episode: a.next_airing_episode,
      sources: { metadata: z ? 'ani.zip' : 'anilist', filler: Object.keys(flags).length ? 'jikan' : null },
      data: list,
    };
  });
}

/** Sub/dub servers from reanime's flix endpoint (the only reanime call). */
async function servers(id, ep, malId) {
  const r = await cached(`flix:${id}:${ep}`, 10 * MIN, () => src.flixServers(id, ep, malId));
  const group = (types) => (r.servers || []).filter((s) => types.includes(s.dataType))
    .map((s) => ({ id: s.$id, name: s.serverName, embed_url: s.dataLink, softsub: s.softsub }))
    .sort((x, y) => (x.name === 'HD-2' ? -1 : y.name === 'HD-2' ? 1 : x.name.localeCompare(y.name)));
  return { sub: group(['sub', 's-sub']), dub: group(['dub', 's-dub']) };
}

/** Build the iframe src the way the player expects. */
function embedUrl(server, { autoPlay = true, skipIntro = false, skipOutro = false, startAt = 0, dub = false } = {}) {
  const u = new URL(server.embed_url);
  if (server.name === 'HD-3' && autoPlay) u.searchParams.set('autostart', 'true');
  if (server.name === 'HD-1' || server.name === 'HD-2') {
    if (autoPlay) u.searchParams.set('autoPlay', 'true');
    u.searchParams.set('skI', String(skipIntro));
    u.searchParams.set('skO', String(skipOutro));
    if (startAt > 0) u.searchParams.set('start_at', String(Math.floor(startAt)));
  }
  if (dub) u.searchParams.set('a', '1');
  u.searchParams.set('project_r_ts', String(Date.now()));
  return u.toString();
}

async function watch(id, ep, ctx) {
  const [a, eps] = await Promise.all([detail(id), episodes(id, ctx)]);
  const episode = eps.data.find((e) => e.episode_number === ep) ?? { episode_number: ep };
  let srv = { sub: [], dub: [] };
  let serverError = null;
  try { srv = await servers(a.id, ep, a.mal_id); }
  catch (error) {
    console.error(JSON.stringify({ event: 'video_provider_error', id, ep, message: error.message }));
    serverError = 'The video provider is temporarily unavailable. Please try again later.';
  }
  return {
    anime: { id: a.id, mal_id: a.mal_id, title: a.title, cover_image: a.cover_image, banner_image: a.banner_image, format: a.format, episodes: eps.total },
    episode,
    prev_episode: ep > 1 ? ep - 1 : null,
    next_episode: ep < eps.total ? ep + 1 : null,
    available: srv.sub.length + srv.dub.length > 0,
    servers: srv,
    ...(serverError ? { server_error: serverError } : {}),
  };
}

// [method, pattern, handler(params, query), description]
const routes = [
  ['GET', '/', () => ({ name: 'api-without-reanime', docs: 'https://github.com/electroo69/animegng', routes: routes.map(([m, p, , d]) => ({ method: m, path: p, description: d })) }), 'This index'],

  // Video (reanime flix)
  ['GET', '/watch/:id/:ep', (p, q, ctx) => watch(Number(p.id), Number(p.ep), ctx), 'Everything for one episode: anime, episode info, prev/next, sub/dub servers'],
  ['GET', '/watch/:id/:ep/embed', async (p, q) => {
    const a = await detail(p.id);
    const srv = await servers(a.id, Number(p.ep), a.mal_id);
    const lang = q.lang === 'dub' ? 'dub' : 'sub';
    const server = srv[lang].find((s) => s.name === q.server) || srv[lang][0];
    if (!server) throw Object.assign(new Error(`No ${lang} servers for episode ${p.ep}`), { status: 404 });
    return { server: server.name, lang, iframe: embedUrl(server, { dub: lang === 'dub', startAt: num(q.start_at) ?? 0, skipIntro: q.skip_intro === 'true', skipOutro: q.skip_outro === 'true' }) };
  }, 'Ready-to-use iframe URL (?lang=sub|dub&server=HD-1|HD-2&start_at=&skip_intro=&skip_outro=)'],
  ['GET', '/servers/:id/:ep', async (p) => { const a = await detail(p.id); return servers(a.id, Number(p.ep), a.mal_id); }, 'Sub/dub player servers only'],

  // Anime (AniList + ani.zip)
  ['GET', '/anime/:id', async (p) => {
    const [a, z] = await Promise.all([detail(p.id), mapping(p.id).catch(() => null)]);
    const { characters, staff, recommendations, ...rest } = a;
    return {
      ...rest,
      ids: { anilist: a.id, ...(z?.mappings ?? { mal_id: a.mal_id }) },
      artwork: z?.images ?? [],
      titles_localized: z?.titles ?? {},
      characters: characters.slice(0, 10),
      staff: staff.slice(0, 10),
      recommendations: recommendations.slice(0, 8),
    };
  }, 'Full anime detail (AniList id). Includes cross-site ids, artwork, localized titles'],
  ['GET', '/anime/:id/episodes', async (p, q, ctx) => {
    const e = await episodes(p.id, ctx);
    if (q.number) return { ...e, data: e.data.filter((x) => x.episode_number === Number(q.number)) };
    const limit = num(q.limit) ?? e.data.length, offset = num(q.offset) ?? 0;
    return { ...e, limit, offset, data: e.data.slice(offset, offset + limit) };
  }, 'Episode list with titles, stills, synopsis, filler/recap (?limit=&offset=&number=)'],
  ['GET', '/anime/:id/thumbnails', async (p, q, ctx) => {
    const e = await episodes(p.id, ctx);
    return { anime_id: e.anime_id, thumbnails: Object.fromEntries(e.data.filter((x) => x.thumbnail).map((x) => [x.episode_number, x.thumbnail])) };
  }, 'Episode number -> thumbnail URL'],
  ['GET', '/anime/:id/characters', async (p) => ({ characters: (await detail(p.id)).characters }), 'Characters + voice actors'],
  ['GET', '/anime/:id/staff', async (p) => ({ staff: (await detail(p.id)).staff }), 'Staff'],
  ['GET', '/anime/:id/relations', async (p) => ({ relations: (await detail(p.id)).relations }), 'Sequels, prequels, side stories…'],
  ['GET', '/anime/:id/recommendations', async (p) => ({ recommendations: (await detail(p.id)).recommendations }), 'Recommendations'],
  ['GET', '/anime/:id/mappings', async (p) => {
    const z = await mapping(p.id);
    if (!z) throw Object.assign(new Error('No mapping found'), { status: 404 });
    return z.mappings;
  }, 'AniList id -> MAL, Kitsu, AniDB, TVDB, TMDB, IMDb, LiveChart…'],

  // Discovery (AniList)
  ['GET', '/home', () => cached('home', 10 * MIN, src.home), 'Trending, seasonal, upcoming, top rated, latest aired — one call'],
  ['GET', '/latest-aired', (p, q) => cached(`latest:${q.page}:${q.limit}`, 5 * MIN, () => src.latestAired({ page: num(q.page) ?? 1, limit: num(q.limit) ?? 24 })), 'Recently aired episodes (?page=&limit=)'],
  ['GET', '/list/:kind', (p, q) => cached(`list:${p.kind}:${q.page}:${q.limit}`, 15 * MIN, () => src.listBy(p.kind, { page: num(q.page) ?? 1, limit: num(q.limit) ?? 20 })), 'trending | popular | top | upcoming | seasonal | airing (?page=&limit=)'],
  ['GET', '/schedule', (p, q) => cached(`sched:${q.tz}:${q.week}`, 15 * MIN, () => src.schedule({ tz: q.tz || 'UTC', week: num(q.week) ?? 0 })), 'Weekly airing calendar (?tz=Asia/Kolkata&week=0)'],
  ['GET', '/search', (p, q) => cached(`search:${new URLSearchParams(q)}`, 10 * MIN, () => src.search(q)),
    'Search/filter (?q=&genre=Action,-Comedy&tag=&format=TV&status=&season=&year=&country=JP&sort=score_desc&page=&limit=)'],
  ['GET', '/search/facets', () => cached('facets', 24 * 60 * MIN, src.facets), 'All genres and tags'],

  // Manga (MangaGang, WeebCentral)
  ['GET', '/manga/home', () => cached('manga:home', 10 * MIN, manga.home), 'Popular and latest-updated manga'],
  ['GET', '/manga/search', (p, q) => {
    const page = Math.max(1, Math.min(num(q.page) ?? 1, 200));
    return cached(`manga:search:${q.q ?? ''}:${q.sort ?? ''}:${page}`, 10 * MIN, () => manga.search({ q: (q.q ?? '').slice(0, 100), sort: q.sort, page }));
  }, 'Search/browse manga (?q=&sort=popular|latest|relevance|az&page=)'],
  ['GET', '/manga/series/:sid', (p) => cached(`manga:series:${p.sid}`, 15 * MIN, () => manga.series(p.sid)), 'Manga detail + chapter list (newest first)'],
  ['GET', '/manga/chapter/:cid', (p) => cached(`manga:chapter:${p.cid}`, 6 * 60 * MIN, () => manga.chapter(p.cid)), 'Page image URLs for one chapter'],
];

const compiled = routes.map(([method, pattern, handler]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { method, re, keys, handler };
});


// Edge cache lifetime per route, in seconds (shared by every visitor via the Cache API).
const EDGE_TTL = [
  [/^\/search\/facets/, 86400],
  [/^\/manga\/chapter\//, 86400],
  [/^\/(latest-aired|watch|servers)/, 300],
  [/^\/anime\/\d+\/episodes/, 900],
  [/./, 600],
];

const json = (status, body, ttl = 0) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': ttl ? `public, max-age=60, s-maxage=${ttl}` : 'no-store',
    },
  });

/** Handle a request whose path has already had the /api prefix removed. */
export async function handle(request, path, ctx) {
  if (request.method === 'OPTIONS') return json(204, null);
  const url = new URL(request.url);
  for (const r of compiled) {
    if (r.method !== request.method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (params.id !== undefined && !/^\d+$/.test(params.id)) return json(400, { error: 'id must be a numeric AniList id (use /search to find it)' });
    if ((params.sid ?? params.cid) !== undefined && !/^[0-9A-Z]{26}$/.test(params.sid ?? params.cid)) return json(400, { error: 'Invalid manga id' });

    const cache = globalThis.caches?.default;
    const hit = await cache?.match(request);
    if (hit) return hit;
    try {
      const data = await r.handler(params, Object.fromEntries(url.searchParams), ctx);
      const ttl = data.server_error ? 0 : EDGE_TTL.find(([re]) => re.test(path))[1];
      const res = json(200, data, ttl);
      if (cache && ttl) ctx.waitUntil(cache.put(request, res.clone()));
      return res;
    } catch (err) {
      console.error(JSON.stringify({ event: 'api_error', path, message: err.message }));
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return json(status, { error: err.message });
    }
  }
  return json(404, { error: 'Not found', hint: 'GET /api/ lists all routes' });
}
