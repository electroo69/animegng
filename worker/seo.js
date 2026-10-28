// Edge SEO for the single-page app. Crawlers (and AI assistants) that don't run JavaScript would
// otherwise see the same empty shell and title on every URL. For page routes we take the built
// index.html and, with HTMLRewriter, give it the route's own title, description, canonical,
// Open Graph/Twitter tags, JSON-LD, and a real HTML summary inside #root (React replaces it on
// load). Also serves robots.txt, llms.txt and the sitemaps.
//
// Used by both the Pages middleware (functions/_middleware.js) and the Worker (worker/index.js).

export const SITE = 'https://animegng.com';
const NAME = 'AnimeGang';
const DEFAULT_DESC = 'Watch anime online free in HD with English sub and dub. Browse trending, seasonal and top-rated anime, episode guides and the weekly airing schedule on AnimeGang.';
const DEFAULT_IMAGE = `${SITE}/logo.png`;

export const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const KINDS = {
  trending: ['Trending Anime', 'The anime everyone is watching right now, updated daily from AniList trends.'],
  popular: ['Most Popular Anime of All Time', 'The most-watched anime ever, ranked by AniList members.'],
  top: ['Top Rated Anime of All Time', 'The highest-rated anime of all time, ranked by average AniList score.'],
  seasonal: ['Anime Airing This Season', 'Every anime airing this season, sorted by popularity.'],
  upcoming: ['Upcoming Anime', 'The most anticipated anime that have not started airing yet.'],
  airing: ['Currently Airing Anime', 'Anime with new episodes airing every week.'],
  latest: ['Latest Anime Episodes', 'The newest anime episodes released, updated as they air.'],
};

// ------------------------------------------------------------------ helpers

export const slugify = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
const clip = (s, n) => { s = strip(s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,.;:]?$/, '…') : s; };
const titleOf = (t) => t?.english || t?.user_preferred || t?.romaji || t?.native || 'Untitled';
const cap = (s) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
const FORMAT = { TV: 'TV series', TV_SHORT: 'TV short', MOVIE: 'movie', SPECIAL: 'special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'music video' };
const STATUS = { RELEASING: 'currently airing', FINISHED: 'finished airing', NOT_YET_RELEASED: 'not yet released', CANCELLED: 'cancelled', HIATUS: 'on hiatus' };
export const animePath = (a) => `/anime/${a.id}/${slugify(titleOf(a.title))}`;
const aired = (a) => (a.next_airing_episode ? a.next_airing_episode.episode - 1 : a.episodes || 0);
const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '');
const currentSeason = () => { const d = new Date(); return { season: SEASONS[Math.floor(d.getUTCMonth() / 3)], year: d.getUTCFullYear() }; };

// Fresh copy for `ttl` seconds; a week-long stale copy is served if the API fails (e.g. AniList
// rate limits), so sitemaps and pages don't error when a crawler arrives at a bad moment.
async function api(path, env, ctx, ttl = 3600) {
  const url = new URL(`/api${path}`, env.API_ORIGIN || 'https://animegng-api.vercel.app');
  const cache = globalThis.caches?.default;
  const key = new Request(`https://seo-cache.internal${path}`);
  const staleKey = new Request(`https://seo-cache.internal/stale${path}`);
  const hit = await cache?.match(key);
  if (hit) return hit.json();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { status: res.status });
    const data = await res.json();
    const body = JSON.stringify(data);
    ctx?.waitUntil?.(Promise.all([
      cache?.put(key, new Response(body, { headers: { 'Cache-Control': `public, max-age=${ttl}` } })),
      cache?.put(staleKey, new Response(body, { headers: { 'Cache-Control': 'public, max-age=604800' } })),
    ]));
    return data;
  } catch (err) {
    if (err.status === 404) throw err;
    const stale = await cache?.match(staleKey);
    if (stale) return stale.json();
    throw err;
  }
}

// ------------------------------------------------------------------ page models
// Each returns { title, description, canonical, image?, noindex?, jsonld: [], body: html }.

const crumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});
const cardList = (list) => `<ul>${list.map((a) => `<li><a href="${animePath(a)}">${esc(titleOf(a.title))}</a>${a.season_year ? ` (${a.season_year})` : ''}${a.format ? ` — ${esc(FORMAT[a.format] || a.format)}` : ''}</li>`).join('')}</ul>`;
const itemList = (name, list) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', name,
  itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + animePath(a), name: titleOf(a.title) })),
});
const nav = () => `<nav><a href="/">Home</a> · <a href="/browse/trending">Trending</a> · <a href="/browse/seasonal">This Season</a> · <a href="/browse/top">Top Rated</a> · <a href="/schedule">Schedule</a> · ${GENRES.slice(0, 8).map((g) => `<a href="/genre/${slugify(g)}">${esc(g)}</a>`).join(' · ')}</nav>`;

async function home(env, ctx) {
  const d = await api('/home', env, ctx);
  const s = `${cap(d.season.season)} ${d.season.year}`;
  return {
    title: `${NAME} — Watch Anime Online Free in HD (Sub & Dub)`,
    description: DEFAULT_DESC,
    canonical: '/',
    preload: d.trending.find((a) => a.banner_image)?.banner_image,
    data: { id: 'ag-home', value: d },
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: `${SITE}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
      { '@context': 'https://schema.org', '@type': 'Organization', name: NAME, url: SITE + '/', logo: DEFAULT_IMAGE },
      itemList('Trending anime', d.trending),
    ],
    body: `${(() => {
      const h = d.trending.find((a) => a.banner_image);
      return h ? `<a class="pr-hero" href="${animePath(h)}"><img src="${esc(h.banner_image)}" alt="" fetchpriority="high"><span class="pr-hero-t">${esc(titleOf(h.title))}</span></a>` : '';
    })()}<h1>${NAME}: watch anime online free in HD</h1><p>${esc(DEFAULT_DESC)}</p>
<h2>Trending now</h2>${cardList(d.trending)}
<h2>Airing this season (${esc(s)})</h2>${cardList(d.seasonal)}
<h2>Latest episodes</h2><ul>${d.latest_aired.slice(0, 15).map((e) => `<li><a href="/watch/${e.anime.id}/${e.episode}">${esc(titleOf(e.anime.title))} episode ${e.episode}</a></li>`).join('')}</ul>
<h2>Top rated anime</h2>${cardList(d.top_rated)}
<h2>Upcoming anime</h2>${cardList(d.upcoming)}`,
  };
}

function animeFacts(a, total) {
  const t = titleOf(a.title);
  const studio = a.studios?.find((s) => s.is_main)?.name;
  const parts = [
    `${t} is ${/^[aeiou]/i.test(FORMAT[a.format] || '') ? 'an' : 'a'} ${FORMAT[a.format] || 'anime'}${studio ? ` by ${studio}` : ''}${a.season && a.season_year ? ` that premiered in ${cap(a.season)} ${a.season_year}` : ''}.`,
    a.status ? `It is ${STATUS[a.status] || cap(a.status)}${a.episodes ? ` with ${a.episodes} episodes` : total ? ` with ${total} episodes released so far` : ''}${a.duration ? ` of about ${a.duration} minutes each` : ''}.` : '',
    a.next_airing_episode ? `Episode ${a.next_airing_episode.episode} airs on ${date(a.next_airing_episode.airing_at)}.` : '',
    a.genres?.length ? `Genres: ${a.genres.join(', ')}.` : '',
    a.average_score ? `Average AniList score: ${(a.average_score / 10).toFixed(1)}/10.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

async function anime(id, env, ctx) {
  const [a, eps] = await Promise.all([api(`/anime/${id}`, env, ctx), api(`/anime/${id}/episodes`, env, ctx).catch(() => null)]);
  const t = titleOf(a.title);
  const total = eps?.total ?? aired(a);
  const facts = animeFacts(a, total);
  const synopsis = strip(a.description);
  const alt = [a.title.romaji, a.title.native].filter((x) => x && x !== t);
  const studio = a.studios?.filter((s) => s.is_main).map((s) => s.name) ?? [];
  const list = eps?.data ?? [];
  return {
    title: `${t} — Watch Online Free (Sub & Dub) | ${NAME}`,
    description: clip(`Watch ${t} online free in HD${total ? `, all ${total} episodes` : ''}, English sub and dub. ${synopsis}`, 158),
    canonical: animePath(a),
    image: a.banner_image || a.cover_image?.extra_large,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': a.format === 'MOVIE' ? 'Movie' : 'TVSeries',
        name: t, alternateName: alt, url: SITE + animePath(a), image: a.cover_image?.extra_large,
        description: clip(synopsis, 500), genre: a.genres, inLanguage: 'ja',
        ...(a.start_date && { startDate: a.start_date }), ...(a.end_date && { endDate: a.end_date }),
        ...(a.format !== 'MOVIE' && total && { numberOfEpisodes: a.episodes || total }),
        ...(studio.length && { productionCompany: studio.map((name) => ({ '@type': 'Organization', name })) }),
        ...(a.trailer?.site === 'youtube' && { trailer: { '@type': 'VideoObject', name: `${t} trailer`, embedUrl: `https://www.youtube.com/embed/${a.trailer.id}`, thumbnailUrl: a.trailer.thumbnail, description: `Official trailer for ${t}.`, uploadDate: a.start_date || undefined } }),
        sameAs: (a.external_links || []).filter((l) => /anilist|myanimelist|crunchyroll|netflix|wikipedia/i.test(l.site + l.url)).map((l) => l.url).slice(0, 6),
      },
      crumbs([['Home', '/'], [t, animePath(a)]]),
    ],
    body: `<article><h1>${esc(t)}</h1>${alt.length ? `<p>Also known as: ${esc(alt.join(' / '))}</p>` : ''}
<p>${esc(facts)}</p>
${synopsis ? `<h2>Synopsis</h2><p>${esc(synopsis).replace(/\n+/g, '</p><p>')}</p>` : ''}
${list.length ? `<h2>${esc(t)} episodes</h2><ol>${list.slice(0, 200).map((e) => `<li><a href="/watch/${a.id}/${e.episode_number}">Episode ${e.episode_number}${e.title && !/^Episode \d+$/.test(e.title) ? `: ${esc(e.title)}` : ''}</a>${e.aired ? ` — aired ${date(e.aired)}` : ''}</li>`).join('')}</ol>` : ''}
${a.characters?.length ? `<h2>Main characters</h2><ul>${a.characters.map((c) => { const va = c.voice_actors?.find((v) => v.language === 'Japanese'); return `<li>${esc(c.name)} (${esc(cap(c.role))})${va ? ` — voiced by ${esc(va.name)}` : ''}</li>`; }).join('')}</ul>` : ''}
${a.relations?.filter((r) => r.type === 'ANIME').length ? `<h2>Related anime</h2><ul>${a.relations.filter((r) => r.type === 'ANIME').map((r) => `<li>${esc(cap(r.relation_type))}: <a href="${animePath(r)}">${esc(titleOf(r.title))}</a></li>`).join('')}</ul>` : ''}
${a.recommendations?.length ? `<h2>Anime like ${esc(t)}</h2>${cardList(a.recommendations)}` : ''}
<p>Genres: ${a.genres.map((g) => GENRES.includes(g) ? `<a href="/genre/${slugify(g)}">${esc(g)}</a>` : esc(g)).join(', ')}${a.season && a.season_year ? ` · Season: <a href="/season/${a.season_year}/${a.season.toLowerCase()}">${esc(cap(a.season))} ${a.season_year}</a>` : ''}</p></article>`,
  };
}

async function watch(id, ep, env, ctx) {
  const [a, eps] = await Promise.all([api(`/anime/${id}`, env, ctx), api(`/anime/${id}/episodes`, env, ctx).catch(() => null)]);
  const t = titleOf(a.title);
  const e = eps?.data?.find((x) => x.episode_number === ep);
  const total = eps?.total ?? aired(a);
  if (!e && ep > total) return null;
  const epTitle = e?.title && !/^Episode \d+$/.test(e.title) ? e.title : '';
  const desc = strip(e?.description) || clip(strip(a.description), 300);
  return {
    title: `${t} Episode ${ep}${epTitle ? ` — ${epTitle}` : ''} | Watch Free | ${NAME}`,
    description: clip(`Watch ${t} episode ${ep}${epTitle ? ` "${epTitle}"` : ''} online free in HD with English sub and dub. ${desc}`, 158),
    canonical: `/watch/${id}/${ep}`,
    image: e?.thumbnail || a.banner_image || a.cover_image?.extra_large,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'TVEpisode', name: epTitle || `Episode ${ep}`, episodeNumber: ep,
        url: `${SITE}/watch/${id}/${ep}`, ...(e?.aired && { datePublished: e.aired.slice(0, 10) }), ...(desc && { description: clip(desc, 500) }),
        ...(e?.thumbnail && { image: e.thumbnail }),
        partOfSeries: { '@type': 'TVSeries', name: t, url: SITE + animePath(a) },
      },
      crumbs([['Home', '/'], [t, animePath(a)], [`Episode ${ep}`, `/watch/${id}/${ep}`]]),
    ],
    body: `<article><h1>${esc(t)} Episode ${ep}${epTitle ? `: ${esc(epTitle)}` : ''}</h1>
<p>Episode ${ep} of ${total || '?'} of <a href="${animePath(a)}">${esc(t)}</a>${e?.aired ? `, aired ${date(e.aired)}` : ''}${e?.duration ? `, ${e.duration} minutes` : ''}. Available with English subtitles${a.country === 'JP' ? ' and dub where released' : ''}.</p>
${desc ? `<h2>Episode summary</h2><p>${esc(desc)}</p>` : ''}
<p>${ep > 1 ? `<a href="/watch/${id}/${ep - 1}">Previous: episode ${ep - 1}</a>` : ''}${ep > 1 && ep < total ? ' · ' : ''}${ep < total ? `<a href="/watch/${id}/${ep + 1}">Next: episode ${ep + 1}</a>` : ''}</p></article>`,
  };
}

async function browse(kind, env, ctx) {
  const meta = KINDS[kind];
  if (!meta) return null;
  const d = kind === 'latest' ? await api('/latest-aired?page=1&limit=40', env, ctx) : await api(`/list/${kind}?page=1&limit=40`, env, ctx);
  const items = kind === 'latest' ? d.results.map((x) => x.anime) : d.results;
  return {
    title: `${meta[0]} | ${NAME}`, description: `${meta[1]} Watch free in HD with sub and dub on ${NAME}.`, canonical: `/browse/${kind}`,
    jsonld: [itemList(meta[0], items), crumbs([['Home', '/'], [meta[0], `/browse/${kind}`]])],
    body: `<h1>${esc(meta[0])}</h1><p>${esc(meta[1])}</p>${kind === 'latest'
      ? `<ul>${d.results.map((x) => `<li><a href="/watch/${x.anime.id}/${x.episode}">${esc(titleOf(x.anime.title))} episode ${x.episode}</a></li>`).join('')}</ul>`
      : cardList(items)}`,
  };
}

async function genre(slug, env, ctx) {
  const g = GENRES.find((x) => slugify(x) === slug);
  if (!g) return null;
  const [pop, top, now] = await Promise.all([
    api(`/search?genre=${encodeURIComponent(g)}&sort=popularity_desc&limit=30`, env, ctx),
    api(`/search?genre=${encodeURIComponent(g)}&sort=score_desc&limit=10`, env, ctx),
    api(`/search?genre=${encodeURIComponent(g)}&status=RELEASING&sort=popularity_desc&limit=10`, env, ctx),
  ]);
  const best = top.results[0];
  const intro = `${NAME} lists ${pop.total >= 5000 ? 'thousands of' : pop.total.toLocaleString('en-US')} ${g.toLowerCase()} anime. ${best ? `The highest-rated is ${titleOf(best.title)}${best.average_score ? ` (${(best.average_score / 10).toFixed(1)}/10)` : ''}. ` : ''}${now.results.length ? `${now.results.length >= 10 ? 'Many' : now.results.length} ${g.toLowerCase()} anime are airing right now, including ${titleOf(now.results[0].title)}.` : ''}`;
  return {
    title: `Best ${g} Anime — Watch Free Online | ${NAME}`, description: clip(`${intro} Watch ${g.toLowerCase()} anime free in HD with sub and dub.`, 158), canonical: `/genre/${slug}`,
    jsonld: [itemList(`Popular ${g} anime`, pop.results), crumbs([['Home', '/'], [`${g} anime`, `/genre/${slug}`]])],
    body: `<h1>Best ${esc(g)} anime</h1><p>${esc(intro)}</p><h2>Most popular ${esc(g.toLowerCase())} anime</h2>${cardList(pop.results)}<h2>Top rated ${esc(g.toLowerCase())} anime</h2>${cardList(top.results)}${now.results.length ? `<h2>${esc(g)} anime airing now</h2>${cardList(now.results)}` : ''}`,
  };
}

async function season(year, s, env, ctx) {
  const S = String(s).toUpperCase();
  if (!SEASONS.includes(S) || year < 1960 || year > new Date().getUTCFullYear() + 1) return null;
  const d = await api(`/search?season=${S}&year=${year}&sort=popularity_desc&limit=50`, env, ctx);
  if (!d.results.length) return null;
  const label = `${cap(S)} ${year}`;
  return {
    title: `${label} Anime Season — Full List | ${NAME}`, description: clip(`All ${d.total} anime from the ${label} season, sorted by popularity, including ${d.results.slice(0, 3).map((a) => titleOf(a.title)).join(', ')}. Watch free with sub and dub.`, 158), canonical: `/season/${year}/${S.toLowerCase()}`,
    jsonld: [itemList(`${label} anime`, d.results), crumbs([['Home', '/'], [`${label} anime`, `/season/${year}/${S.toLowerCase()}`]])],
    body: `<h1>${esc(label)} anime</h1><p>${d.total} anime premiered in ${esc(label)}. The most popular are listed below.</p>${cardList(d.results)}`,
  };
}

const staticPage = (title, description, canonical, noindex = false) => ({ title: `${title} | ${NAME}`, description, canonical, noindex, jsonld: [], body: `<h1>${esc(title)}</h1><p>${esc(description)}</p>` });

async function pageFor(url, env, ctx) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return home(env, ctx);
  if ((m = p.match(/^\/anime\/(\d+)(?:\/[\w-]*)?$/))) return anime(Number(m[1]), env, ctx);
  if ((m = p.match(/^\/watch\/(\d+)(?:\/(\d+))?$/))) return watch(Number(m[1]), Number(m[2] || 1), env, ctx);
  if ((m = p.match(/^\/browse\/([\w-]+)$/))) return browse(m[1], env, ctx);
  if ((m = p.match(/^\/genre\/([\w-]+)$/))) return genre(m[1], env, ctx);
  if ((m = p.match(/^\/season\/(\d{4})\/(\w+)$/))) return season(Number(m[1]), m[2], env, ctx);
  if (p === '/schedule') return staticPage('Anime Airing Schedule', 'This week’s anime release schedule with air times in your timezone and countdowns to every new episode.', '/schedule');
  // Filtered search result pages duplicate genre/season pages: keep them out of the index.
  if (p === '/search') return staticPage('Browse & Search Anime', 'Search thousands of anime by title, genre, format, season, year and status.', '/search', url.search.length > 1);
  return undefined;
}

// ------------------------------------------------------------------ HTML injection

const PRERENDER_STYLE = '<style>#prerender{max-width:1100px;margin:0 auto;padding:96px 20px 40px;color:#c8c8d0;font:15px/1.6 system-ui,sans-serif}#prerender a{color:#ff6b74}#prerender h1{color:#fff;font-size:28px;line-height:1.2}#prerender h2{color:#fff;font-size:19px;margin-top:28px}.pr-hero{position:relative;display:block;margin:-96px calc(50% - 50vw) 24px;height:min(82vh,860px);min-height:580px;overflow:hidden;background:#0b0b10}.pr-hero img{width:100%;height:100%;object-fit:cover;object-position:center 25%}.pr-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0b0b10,rgba(11,11,16,.55) 60%,transparent),linear-gradient(0deg,#0b0b10,transparent 40%)}.pr-hero-t{position:absolute;left:max(20px,calc(50vw - 780px));bottom:120px;z-index:1;max-width:640px;color:#fff;font:900 clamp(32px,5vw,60px)/1.05 system-ui,sans-serif}</style>';

function headTags(page) {
  const url = SITE + page.canonical;
  const image = page.image || DEFAULT_IMAGE;
  return [
    `<meta name="description" content="${esc(page.description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    page.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:type" content="${page.canonical.startsWith('/watch/') ? 'video.episode' : page.canonical.startsWith('/anime/') ? 'video.tv_show' : 'website'}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    ...page.jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
    ...(page.preload ? [`<link rel="preload" as="image" href="${esc(page.preload)}" fetchpriority="high">`] : []),
    PRERENDER_STYLE,
  ].join('\n');
}

function inject(res, page) {
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(page.title) })
    .on('meta[name="description"]', { element: (el) => el.remove() })
    .on('head', { element: (el) => el.append(headTags(page), { html: true }) })
    .on('div#root', {
      element: (el) => {
        el.setInnerContent(`<div id="prerender">${nav()}${page.body}</div>`, { html: true });
        // The API data this page was built from, so the app renders on first paint instead of refetching it (src/lib/api.ts).
        if (page.data) el.after(`<script type="application/json" id="${page.data.id}">${JSON.stringify(page.data.value).replace(/</g, '\\u003c')}</script>`, { html: true });
      },
    })
    .transform(res);
}

// ------------------------------------------------------------------ robots, llms, sitemaps

const xml = (body) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
const urlset = (urls) => xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(SITE + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`);
const ANIME_SITEMAPS = 20; // x 50 most popular each = 1,000 titles

async function sitemap(p, env, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  if (p === '/sitemap.xml') {
    const files = ['pages', 'episodes', 'seasonal', ...Array.from({ length: ANIME_SITEMAPS }, (_, i) => `anime-${i + 1}`)];
    return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `<sitemap><loc>${SITE}/sitemap-${f}.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>`);
  }
  if (p === '/sitemap-pages.xml') {
    const { season: S, year } = currentSeason();
    const seasons = [];
    for (let i = 0, y = year, s = SEASONS.indexOf(S); i < 16; i++) { seasons.push(`/season/${y}/${SEASONS[s].toLowerCase()}`); if (--s < 0) { s = 3; y--; } }
    return urlset([
      { loc: '/', lastmod: today }, { loc: '/schedule', lastmod: today },
      ...Object.keys(KINDS).map((k) => ({ loc: `/browse/${k}`, lastmod: today })),
      ...GENRES.map((g) => ({ loc: `/genre/${slugify(g)}` })), ...seasons.map((loc) => ({ loc })),
    ]);
  }
  if (p === '/sitemap-episodes.xml') {
    const d = await api('/latest-aired?page=1&limit=100', env, ctx, 3600);
    return urlset(d.results.map((e) => ({ loc: `/watch/${e.anime.id}/${e.episode}`, lastmod: e.aired_at.slice(0, 10) })));
  }
  if (p === '/sitemap-seasonal.xml') {
    const [a, b] = await Promise.all([api('/list/seasonal?page=1&limit=50', env, ctx, 86400), api('/list/airing?page=1&limit=50', env, ctx, 86400)]);
    const seen = new Set();
    return urlset([...a.results, ...b.results].filter((x) => !seen.has(x.id) && seen.add(x.id)).map((x) => ({ loc: animePath(x), lastmod: today })));
  }
  const m = p.match(/^\/sitemap-anime-(\d+)\.xml$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= ANIME_SITEMAPS) {
    const d = await api(`/list/popular?page=${m[1]}&limit=50`, env, ctx, 86400);
    return urlset(d.results.map((x) => ({ loc: animePath(x) })));
  }
  return null;
}

const ROBOTS = `# AnimeGang — all crawlers, including AI search and assistant crawlers, are welcome.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /ad.html
Disallow: /native.html
Disallow: /ad$
Disallow: /native$
Disallow: /embeds/
Disallow: /party/
Disallow: /library
Disallow: /settings
Disallow: /reset

Sitemap: ${SITE}/sitemap.xml
`;

const LLMS = `# ${NAME}

> ${DEFAULT_DESC}

AnimeGang is a free anime streaming and discovery site. Anime metadata (titles, synopses, episode lists, air dates, characters, studios) comes from AniList and ani.zip.

## Key pages
- [Home](${SITE}/): trending, seasonal, latest episodes, top rated
- [Airing schedule](${SITE}/schedule): this week's episodes with air times
- [Trending anime](${SITE}/browse/trending)
- [Anime airing this season](${SITE}/browse/seasonal)
- [Top rated anime](${SITE}/browse/top)
- [Most popular anime](${SITE}/browse/popular)
- [Latest episodes](${SITE}/browse/latest)

## Genres
${GENRES.map((g) => `- [${g} anime](${SITE}/genre/${slugify(g)})`).join('\n')}

## URL patterns
- Anime page: ${SITE}/anime/{anilist-id}/{slug} — synopsis, episode list, characters, related titles
- Episode page: ${SITE}/watch/{anilist-id}/{episode-number}
- Season page: ${SITE}/season/{year}/{winter|spring|summer|fall}
`;

// ------------------------------------------------------------------ entry

/** Returns a Response for SEO-handled requests, or null to let the caller serve normally. */
export async function handleSeo(request, env, ctx, fetchIndex) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === '/robots.txt') return new Response(ROBOTS, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  if (p === '/llms.txt') return new Response(LLMS, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  if (/^\/sitemap(-[\w-]+)?\.xml$/.test(p)) {
    try {
      return (await sitemap(p, env, ctx)) ?? new Response('Not found', { status: 404 });
    } catch {
      return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
    }
  }
  // Only page routes (no file extension, not the API).
  if (p.startsWith('/api') || /\.[a-z0-9]+$/i.test(p)) return null;

  let page;
  try {
    page = await pageFor(url, env, ctx);
  } catch (err) {
    if (err.status === 404) page = null;
    else page = undefined; // upstream hiccup: serve the plain app rather than an error
  }
  if (page === undefined) return null;
  const index = await fetchIndex();
  if (page === null) {
    return inject(new Response(index.body, { status: 404, headers: index.headers }), {
      ...staticPage('Page not found', 'This page does not exist on AnimeGang.', url.pathname, true), canonical: url.pathname,
    });
  }
  const res = inject(index, page);
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=0, s-maxage=600');
  return out;
}
