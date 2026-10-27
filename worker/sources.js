// Upstream data sources. Everything here is public and needs no API key.
//   AniList GraphQL  — anime metadata, search, trending, schedule
//   ani.zip          — cross-site id mappings, per-episode titles/stills/overviews, artwork
//   Jikan (MAL)      — filler/recap flags (optional; skipped if Jikan is slow/down)
//   reanime /api/flix — the ONLY reanime call: video player servers

const ANILIST = 'https://graphql.anilist.co';
const ANIZIP = 'https://api.ani.zip/mappings';
const JIKAN = 'https://api.jikan.moe/v4';
const FLIX = 'https://reanime.to/api/flix';
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { timeout = 15000, ...init } = {}) {
  const res = await fetch(url, { ...init, headers: { ...UA, ...init.headers }, signal: AbortSignal.timeout(timeout) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.errors?.[0]?.message || body?.error || `HTTP ${res.status} from ${new URL(url).host}`), { status: res.status, body, headers: res.headers });
  return body;
}

// ---------------------------------------------------------------- AniList

export async function anilist(query, variables = {}, retry = true) {
  try {
    const body = await fetchJson(ANILIST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    if (body.errors?.length) throw Object.assign(new Error(body.errors[0].message), { status: body.errors[0].status || 502 });
    return body.data;
  } catch (err) {
    // AniList allows ~30 req/min right now; wait once on 429 if the wait is short.
    const wait = Number(err.headers?.get?.('retry-after'));
    if (retry && err.status === 429 && wait > 0 && wait <= 15) {
      await sleep(wait * 1000);
      return anilist(query, variables, false);
    }
    throw err;
  }
}

const CARD = `
  id idMal
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium color }
  bannerImage format status episodes duration genres
  averageScore popularity season seasonYear isAdult countryOfOrigin
  nextAiringEpisode { airingAt episode timeUntilAiring }`;

const DETAIL = `
  ${CARD}
  description(asHtml: false) synonyms source hashtag meanScore favourites trending
  startDate { year month day } endDate { year month day }
  trailer { id site thumbnail }
  tags { id name category rank description isGeneralSpoiler isMediaSpoiler isAdult }
  studios { edges { isMain node { id name } } }
  externalLinks { id site url type language }
  rankings { id rank type format year season allTime context }
  relations { edges { relationType node { id idMal type format status season seasonYear title { romaji english native userPreferred } coverImage { extraLarge large medium color } } } }
  characters(perPage: 25, sort: [ROLE, RELEVANCE]) { edges { role node { id name { full native } image { large } }
    voiceActors { id name { full native } image { large } languageV2 } } }
  staff(perPage: 25, sort: RELEVANCE) { edges { role node { id name { full native } image { large } } } }
  recommendations(perPage: 15, sort: RATING_DESC) { nodes { rating mediaRecommendation { ${CARD} } } }
  streamingEpisodes { title thumbnail url site }`;

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);
const date = (d) => (d?.year ? { year: d.year, month: d.month, day: d.day } : null);

/** AniList media -> compact card (field names follow the old reanime shape where sensible). */
export function card(m) {
  if (!m) return null;
  return {
    id: m.id,
    mal_id: m.idMal ?? null,
    title: { english: m.title?.english ?? null, romaji: m.title?.romaji ?? null, native: m.title?.native ?? null, user_preferred: m.title?.userPreferred ?? null },
    cover_image: m.coverImage ? { color: m.coverImage.color, extra_large: m.coverImage.extraLarge, large: m.coverImage.large, medium: m.coverImage.medium } : null,
    banner_image: m.bannerImage ?? null,
    format: m.format ?? null,
    status: m.status ?? null,
    genres: m.genres ?? [],
    season: m.season ?? null,
    season_year: m.seasonYear ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    average_score: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    country: m.countryOfOrigin ?? null,
    is_adult: m.isAdult ?? false,
    next_airing_episode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airing_at: iso(m.nextAiringEpisode.airingAt), time_until_airing: m.nextAiringEpisode.timeUntilAiring }
      : null,
  };
}

export async function animeDetail(id) {
  const d = await anilist(`query($id:Int){ Media(id:$id, type:ANIME){ ${DETAIL} } }`, { id: Number(id) });
  const m = d.Media;
  if (!m) throw Object.assign(new Error('Anime not found'), { status: 404 });
  return {
    ...card(m),
    description: m.description,
    synonyms: m.synonyms,
    source: m.source,
    hashtag: m.hashtag,
    mean_score: m.meanScore,
    favourites: m.favourites,
    trending: m.trending,
    start_date: date(m.startDate),
    end_date: date(m.endDate),
    trailer: m.trailer?.site === 'youtube'
      ? { id: m.trailer.id, site: 'youtube', thumbnail: m.trailer.thumbnail, url: `https://www.youtube.com/watch?v=${m.trailer.id}` }
      : m.trailer,
    tags: m.tags,
    studios: m.studios.edges.map((e) => ({ id: e.node.id, name: e.node.name, is_main: e.isMain })),
    external_links: m.externalLinks,
    rankings: m.rankings,
    relations: m.relations.edges.map((e) => ({ relation_type: e.relationType, type: e.node.type, ...card(e.node) })),
    characters: m.characters.edges.map((e) => ({
      id: e.node.id, name: e.node.name.full, native_name: e.node.name.native, image: e.node.image.large, role: e.role,
      voice_actors: e.voiceActors.map((v) => ({ id: v.id, name: v.name.full, native_name: v.name.native, image: v.image.large, language: v.languageV2 })),
    })),
    staff: m.staff.edges.map((e) => ({ id: e.node.id, name: e.node.name.full, native_name: e.node.name.native, image: e.node.image.large, role: e.role })),
    recommendations: m.recommendations.nodes.filter((n) => n.mediaRecommendation).map((n) => ({ ...card(n.mediaRecommendation), rating: n.rating })),
    streaming_episodes: m.streamingEpisodes,
  };
}

export async function animeCard(id) {
  const d = await anilist(`query($id:Int){ Media(id:$id, type:ANIME){ ${CARD} } }`, { id: Number(id) });
  if (!d.Media) throw Object.assign(new Error('Anime not found'), { status: 404 });
  return card(d.Media);
}

const SORTS = {
  popularity_desc: 'POPULARITY_DESC', score_desc: 'SCORE_DESC', trending_desc: 'TRENDING_DESC',
  year_desc: 'START_DATE_DESC', year_asc: 'START_DATE', title_asc: 'TITLE_ROMAJI', favourites_desc: 'FAVOURITES_DESC', updated_desc: 'UPDATED_AT_DESC',
};
const splitIncl = (s) => {
  const inc = [], exc = [];
  for (const v of String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean)) (v.startsWith('-') ? exc : inc).push(v.replace(/^-/, ''));
  return [inc.length ? inc : undefined, exc.length ? exc : undefined];
};
const enumish = (v) => (v ? String(v).trim().toUpperCase().replace(/[\s-]+/g, '_') : undefined);

/** Search/filter. genre & tag accept "A,B,-C" (minus = exclude). */
export async function search(f = {}) {
  const [genre_in, genre_not_in] = splitIncl(f.genre);
  const [tag_in, tag_not_in] = splitIncl(f.tag);
  const perPage = Math.min(Number(f.limit) || 20, 50);
  const page = Number(f.page) || (f.offset ? Math.floor(Number(f.offset) / perPage) + 1 : 1);
  const vars = {
    page, perPage,
    search: f.q || undefined,
    genre_in, genre_not_in, tag_in, tag_not_in,
    format: f.format ? String(f.format).split(',').map(enumish) : undefined,
    status: enumish(f.status),
    season: enumish(f.season),
    seasonYear: f.year ? Number(f.year) : undefined,
    country: f.country ? String(f.country).toUpperCase() : undefined,
    isAdult: f.adult === 'true' ? undefined : false,
    sort: [SORTS[f.sort] || (f.q ? 'SEARCH_MATCH' : 'POPULARITY_DESC')],
  };
  const d = await anilist(`query($page:Int,$perPage:Int,$search:String,$genre_in:[String],$genre_not_in:[String],$tag_in:[String],$tag_not_in:[String],
      $format:[MediaFormat],$status:MediaStatus,$season:MediaSeason,$seasonYear:Int,$country:CountryCode,$isAdult:Boolean,$sort:[MediaSort]){
    Page(page:$page, perPage:$perPage){ pageInfo{ total currentPage lastPage hasNextPage }
      media(type:ANIME, search:$search, genre_in:$genre_in, genre_not_in:$genre_not_in, tag_in:$tag_in, tag_not_in:$tag_not_in,
        format_in:$format, status:$status, season:$season, seasonYear:$seasonYear, countryOfOrigin:$country, isAdult:$isAdult, sort:$sort){ ${CARD} } } }`, vars);
  return pageOut(d.Page);
}

const pageOut = (p) => ({
  page: p.pageInfo.currentPage, last_page: p.pageInfo.lastPage, total: p.pageInfo.total, has_more: p.pageInfo.hasNextPage,
  results: p.media.map(card),
});

export async function facets() {
  const d = await anilist(`{ GenreCollection MediaTagCollection { name category isAdult description } }`);
  return { genres: d.GenreCollection, tags: d.MediaTagCollection };
}

function currentSeason(now = new Date()) {
  const m = now.getUTCMonth();
  return { season: ['WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL', 'WINTER'][m], year: m === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear() };
}

export async function home() {
  const { season, year } = currentSeason();
  const now = Math.floor(Date.now() / 1000);
  const d = await anilist(`query($season:MediaSeason,$year:Int,$now:Int){
    trending: Page(perPage:12){ media(type:ANIME, sort:TRENDING_DESC, isAdult:false){ ${CARD} } }
    seasonal: Page(perPage:12){ media(type:ANIME, season:$season, seasonYear:$year, sort:POPULARITY_DESC, isAdult:false){ ${CARD} } }
    upcoming: Page(perPage:12){ media(type:ANIME, status:NOT_YET_RELEASED, sort:POPULARITY_DESC, isAdult:false){ ${CARD} } }
    top: Page(perPage:12){ media(type:ANIME, sort:SCORE_DESC, isAdult:false){ ${CARD} } }
    aired: Page(perPage:24){ airingSchedules(airingAt_lesser:$now, sort:TIME_DESC){ episode airingAt media{ ${CARD} } } }
  }`, { season, year, now });
  return {
    season: { season, year },
    trending: d.trending.media.map(card),
    seasonal: d.seasonal.media.map(card),
    upcoming: d.upcoming.media.map(card),
    top_rated: d.top.media.map(card),
    latest_aired: d.aired.airingSchedules.filter((s) => s.media && !s.media.isAdult).map(airing),
  };
}

const airing = (s) => ({ episode: s.episode, aired_at: iso(s.airingAt), anime: card(s.media) });

export async function latestAired({ page = 1, limit = 24 } = {}) {
  const d = await anilist(`query($page:Int,$perPage:Int,$now:Int){ Page(page:$page, perPage:$perPage){ pageInfo{ total currentPage lastPage hasNextPage }
    airingSchedules(airingAt_lesser:$now, sort:TIME_DESC){ episode airingAt media{ ${CARD} } } } }`,
  { page: Number(page), perPage: Math.min(Number(limit), 50), now: Math.floor(Date.now() / 1000) });
  return { page: d.Page.pageInfo.currentPage, has_more: d.Page.pageInfo.hasNextPage, results: d.Page.airingSchedules.filter((s) => s.media && !s.media.isAdult).map(airing) };
}

export async function listBy(kind, { page = 1, limit = 20 } = {}) {
  const { season, year } = currentSeason();
  const args = {
    trending: 'sort:TRENDING_DESC',
    popular: 'sort:POPULARITY_DESC',
    top: 'sort:SCORE_DESC',
    upcoming: 'status:NOT_YET_RELEASED, sort:POPULARITY_DESC',
    seasonal: `season:${season}, seasonYear:${year}, sort:POPULARITY_DESC`,
    airing: 'status:RELEASING, sort:POPULARITY_DESC',
  }[kind];
  if (!args) throw Object.assign(new Error(`Unknown list "${kind}"`), { status: 400 });
  const d = await anilist(`query($page:Int,$perPage:Int){ Page(page:$page, perPage:$perPage){ pageInfo{ total currentPage lastPage hasNextPage }
    media(type:ANIME, isAdult:false, ${args}){ ${CARD} } } }`, { page: Number(page), perPage: Math.min(Number(limit), 50) });
  return { list: kind, ...pageOut(d.Page) };
}

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffset(tz, at = Date.now()) {
  const p = (zone) => Date.parse(new Date(at).toLocaleString('en-US', { timeZone: zone }));
  return p(tz) - p('UTC');
}
const ymd = (ms, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** Airing calendar for a Monday-Sunday week in the given timezone. week=0 this week, 1 next, -1 last. */
export async function schedule({ tz = 'UTC', week = 0 } = {}) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw Object.assign(new Error(`Invalid timezone "${tz}"`), { status: 400 }); }
  const off = tzOffset(tz);
  const localNow = new Date(Date.now() + off);
  const dow = (localNow.getUTCDay() + 6) % 7; // Monday = 0
  const mondayLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - dow + 7 * Number(week));
  const start = Math.floor((mondayLocal - off) / 1000);
  const end = start + 7 * 86400;

  const items = [];
  for (let page = 1; page <= 10; page++) {
    const d = await anilist(`query($page:Int,$s:Int,$e:Int){ Page(page:$page, perPage:50){ pageInfo{ hasNextPage }
      airingSchedules(airingAt_greater:$s, airingAt_lesser:$e, sort:TIME){ episode airingAt media{ ${CARD} } } } }`, { page, s: start, e: end });
    items.push(...d.Page.airingSchedules.filter((s) => s.media && !s.media.isAdult));
    if (!d.Page.pageInfo.hasNextPage) break;
  }
  const days = new Map();
  for (let i = 0; i < 7; i++) {
    const ms = (start + i * 86400) * 1000;
    days.set(ymd(ms, tz), { date: ymd(ms, tz), day: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(ms), episodes: [] });
  }
  for (const s of items) {
    const key = ymd(s.airingAt * 1000, tz);
    days.get(key)?.episodes.push({
      ...airing(s),
      local_time: new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(s.airingAt * 1000),
      aired: s.airingAt * 1000 <= Date.now(),
    });
  }
  return { timezone: tz, week: Number(week), week_start: ymd(start * 1000, tz), week_end: ymd((end - 1) * 1000, tz), schedule: [...days.values()] };
}

// ---------------------------------------------------------------- ani.zip

export async function anizip(anilistId) {
  try {
    return await fetchJson(`${ANIZIP}?anilist_id=${Number(anilistId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------------------------------------------------------------- Jikan (optional)

let jikanDownUntil = 0;
/** filler/recap flags keyed by episode number. Returns {} if Jikan is unavailable. */
export async function jikanFlags(malId) {
  if (!malId || Date.now() < jikanDownUntil) return {};
  const flags = {};
  try {
    for (let page = 1; page <= 30; page++) {
      const d = await fetchJson(`${JIKAN}/anime/${malId}/episodes?page=${page}`, { timeout: 5000 });
      for (const e of d.data ?? []) flags[e.mal_id] = { is_filler: !!e.filler, is_recap: !!e.recap, mal_title: e.title };
      if (!d.pagination?.has_next_page) break;
      await sleep(400); // Jikan: ~3 req/s
    }
  } catch {
    jikanDownUntil = Date.now() + 5 * 60_000; // back off for 5 minutes
  }
  return flags;
}

// ---------------------------------------------------------------- reanime flix (video only)

export async function flixServers(anilistId, episode, malId) {
  const qs = malId ? `?mal=${malId}` : '';
  return fetchJson(`${FLIX}/${Number(anilistId) || 0}/${Number(episode)}${qs}`);
}
