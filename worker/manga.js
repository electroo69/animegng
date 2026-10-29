// MangaGang data: WeebCentral (the "smart" primary source of serene-hopper's manga-reader), parsed with plain
// regexes so the API stays dependency-free. Covers and page images are hotlinkable, so no image proxy.
// Shapes: MangaCard { id, slug, title, cover, cover_large, year, status, type, authors, tags, official }.

const BASE = 'https://weebcentral.com';
const COVERS = 'https://temp.compsci88.com/cover';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PAGE_SIZE = 32;

async function fetchPage(path) {
  const res = await fetch(BASE + path, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', Referer: BASE + '/' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw Object.assign(new Error(`Manga source returned ${res.status}`), { status: res.status === 404 ? 404 : 502 });
  return res;
}
const page = async (path) => (await fetchPage(path)).text();

const toChapter = (id, name, date) => ({ id, name, number: Number(name.match(/(\d+(?:\.\d+)?)/)?.[1]) || null, date });

// Full chapter lists can be 2 MB+ (One Piece). On Cloudflare, stream them through HTMLRewriter (native
// parser, little CPU) so a long list doesn't hit the Worker CPU limit; on Node (dev, tests) use regexes.
async function chapterList(id) {
  const res = await fetchPage(`/series/${id}/full-chapter-list`);
  if (typeof HTMLRewriter === 'undefined') {
    return (await res.text()).split('<a href="/chapters/').slice(1).map((chunk) => {
      const cid = chunk.match(/^([0-9A-Z]{26})"/)?.[1];
      return cid ? toChapter(cid, one(/<span class="">([^<]+)<\/span>/, chunk) ?? 'Chapter', chunk.match(/datetime="([^"]+)"/)?.[1] ?? null) : null;
    }).filter(Boolean);
  }
  const out = [];
  let cur = null;
  await new HTMLRewriter()
    .on('a[href^="/chapters/"]', {
      element(el) {
        const cid = el.getAttribute('href').slice(10);
        cur = /^[0-9A-Z]{26}$/.test(cid) ? { id: cid, name: '', date: null } : null;
        if (cur) out.push(cur);
      },
    })
    .on('a[href^="/chapters/"] span[class=""]', { text(t) { if (cur) cur.name += t.text; } })
    .on('a[href^="/chapters/"] time', { element(el) { if (cur) cur.date = el.getAttribute('datetime'); } })
    .transform(res)
    .arrayBuffer();
  return out.map((c) => toChapter(c.id, text(c.name) || 'Chapter', c.date));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (s = '') =>
  s.replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ')
    .trim();
const all = (re, s) => [...s.matchAll(re)].map((m) => text(m[1]));
const one = (re, s) => { const m = s.match(re); return m ? text(m[1]) : null; };
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const covers = (id) => ({ cover: `${COVERS}/small/${id}.webp`, cover_large: `${COVERS}/normal/${id}.webp` });

// One "Full Display" search result card.
function card(html) {
  const link = html.match(/\/series\/([0-9A-Z]{26})\/([^"/?#]*)/);
  if (!link) return null;
  const id = link[1];
  const title = one(/class="line-clamp-1 link link-hover">([^<]+)</, html) ?? one(/alt="([^"]+?) cover"/, html);
  if (!title) return null;
  const tags = html.match(/<strong>Tag\(s\):\s*<\/strong>([\s\S]*?)<\/div>/);
  return {
    id,
    slug: link[2],
    title,
    ...covers(id),
    year: Number(one(/<strong>Year:<\/strong>\s*<span>(\d{4})/, html)) || null,
    status: one(/<strong>Status:<\/strong>\s*<span>([^<]+)/, html),
    type: one(/<strong>Type:<\/strong>\s*<span>([^<]+)/, html),
    authors: uniq(all(/search\?author=[^"]*"[^>]*>([^<]+)</g, html)),
    tags: tags ? uniq(all(/<span>([^<]+?),?\s*<\/span>/g, tags[1]).map((t) => t.replace(/,$/, ''))) : [],
    official: html.includes('data-tip="Official Translation"'),
  };
}

const SORTS = { popular: 'Popularity', latest: 'Latest Updates', relevance: 'Best Match', az: 'Alphabet' };

/** Search/browse. sort: popular | latest | relevance | az. Adult titles are always excluded. */
export async function search({ q = '', sort, page: n = 1 } = {}) {
  const by = SORTS[sort] ?? (q ? SORTS.relevance : SORTS.popular);
  const params = new URLSearchParams({
    text: q, sort: by, order: by === 'Alphabet' || by === 'Best Match' ? 'Ascending' : 'Descending',
    official: 'Any', anime: 'Any', adult: 'False', display_mode: 'Full Display',
    limit: String(PAGE_SIZE), offset: String((Math.max(1, n) - 1) * PAGE_SIZE),
  });
  const html = await page(`/search/data?${params}`);
  const results = html.split('<article class="bg-base-300 flex gap-4 p-4">').slice(1).map(card).filter(Boolean);
  return { page: Math.max(1, n), has_next: results.length === PAGE_SIZE, results };
}

export async function home() {
  const [popular, latest] = await Promise.all([search({ sort: 'popular' }), search({ sort: 'latest' })]);
  return { popular: popular.results, latest: latest.results };
}

/** Series detail plus the full chapter list (newest first). */
export async function series(id) {
  const [html, chapters] = await Promise.all([page(`/series/${id}`), chapterList(id)]);
  const title = one(/<h1 class="hidden md:block[^"]*">([^<]+)/, html) ?? one(/<h1[^>]*>([^<]+)/, html);
  if (!title) throw Object.assign(new Error('Manga not found'), { status: 404 });
  const field = (label) => html.match(new RegExp(`<strong>${label}:?\\s*</strong>([\\s\\S]*?)</li>`))?.[1] ?? '';
  return {
    id,
    title,
    ...covers(id),
    description: one(/<p class="whitespace-pre-wrap break-words">([\s\S]*?)<\/p>/, html) ?? '',
    authors: uniq(all(/search\?author=[^"]*"[^>]*>([^<]+)</g, field('Author\\(s\\)'))),
    tags: uniq(all(/included_tag=[^"]*"[^>]*>([^<]+)</g, html)),
    type: one(/included_type=[^"]*"[^>]*>([^<]+)</, html),
    status: one(/included_status=[^"]*"[^>]*>([^<]+)</, html),
    year: Number(one(/<span>(\d{4})<\/span>/, field('Released'))) || null,
    official: /Yes/.test(field('Official Translation')),
    anime: /Yes/.test(field('Anime Adaptation')),
    chapters,
  };
}

/** Page image URLs for one chapter, in reading order. */
export async function chapter(id) {
  const html = await page(`/chapters/${id}/images?is_prev=False&current_page=1&reading_style=long_strip`);
  const pages = uniq([...html.matchAll(/<img\s[^>]*?src="([^"]+)"[^>]*?alt="Page \d+"/g)].map((m) => m[1]));
  if (!pages.length) throw Object.assign(new Error('No pages found for this chapter'), { status: 404 });
  return { id, pages };
}
