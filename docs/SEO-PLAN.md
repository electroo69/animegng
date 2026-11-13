# AnimeGang SEO plan (drafted 2026-11-13, waiting for approval)

Goal: rank for "watch anime free online" and "watch anime for free online", and grow search traffic overall.

## 1. Keyword research

US monthly search volumes from Ahrefs' public site pages. Autocomplete phrases come from Google Suggest.

### Head terms (the cluster you want)

| Keyword | US searches / month |
|---|---|
| watch anime | 77K |
| free anime | 48K |
| watch anime online | 39K |
| watch anime free | 15K |
| watch anime online free | 14K |

"watch anime free online" and "watch anime for free online" are word-order variants of the last two. Google treats them as the same intent, so one page (the home page) targets all of them.

### Brand terms (shows where the real volume is)

| Keyword | US searches / month |
|---|---|
| 9anime | 811K |
| aniwatch | 425K |
| aniwave | 176K |
| zoro.to | 118K |
| hianime | 64K |

People search for a site by name far more than for "watch anime free". The sites that win are the ones people remember and search for.

### Long-tail patterns (from Google autocomplete)

| Pattern | Examples | Do we have a page? |
|---|---|---|
| Title searches | "watch one piece free", "watch naruto shippuden english dub", "overflow anime" (33K) | Yes: anime and episode pages |
| Dub | "english dubbed anime", "anime dub sites", "watch anime online dubbed" | No |
| Release timing | "anime episodes released today", "anime schedule today", "new anime 2026", "new anime this season" | Partly: schedule, latest, seasonal |
| Similar shows | "anime like solo leveling", "anime like death note" | No (we have the data) |
| Lists | "best anime of all time", "best anime 2026", "anime movies" | Partly: top rated; no movies page |
| Site lists | "anime websites", "free anime streaming sites", "anime sites no ads" | No |
| Watch help | "watch one piece without filler", "watch naruto in order" | No |

## 2. Competitors

| Site | Domain Rating | Linking sites | What they do |
|---|---|---|---|
| aniwaves.tv | no data | no data | Home page is a keyword landing page: H1 "Watch Anime Online for FREE" and 10 FAQ questions (about 2,250 words). It ranks on DuckDuckGo for the target query. About, Contact, DMCA, Terms and FAQ pages. Sitemap split by type, genre and anime. |
| animevillage.org | no data | no data | H1 "Watch Anime Online Free", FAQ schema on the home page, A–Z pages, genre pages, 364 URLs in the sitemap. |
| yomi.to | 4 | 27 | About 360K search visits a month with almost no backlinks and only 8 URLs in its sitemap. Extras: filler guides, skip controls, AniList sync. Its traffic halved last month. |
| aniwatch.fyi | no data | no data | Blocks automated visitors, so no page data. |
| animegng.com (you) | no data | no data | Server-rendered pages, 5 kinds of structured data, sitemap index with 23 files. Technically ahead of all four. |

What this shows:
- Your technical SEO is already better than theirs. The gap is not there.
- yomi.to proves a site with no backlinks can get big traffic, so links are not the main barrier.
- What they have and you lack: a home page written around the target phrase with an FAQ, trust pages (About, DMCA, Contact), and pages for dub, A–Z and site-comparison searches.
- Who ranks for "watch anime free online" on DuckDuckGo: AniCult, Tubi, Aniwave, Guru99's "16 best free anime websites", Gotaku, Plex. Most have the exact phrase in the title and H1.

## 3. Audit of animegng.com

| Area | Finding |
|---|---|
| Google status | Demoted since 8 Nov (about 20 impressions a day, not shown even for "animegng"). This overrides everything else until it lifts. |
| Home page | Title already says "Watch Anime Online Free in HD". Only the crawler copy has the H1 and intro; visitors see no copy and there is no FAQ. |
| Anime pages | Good: TVSeries schema, synopsis, episodes, characters. No FAQ. Title lacks "English". |
| Episode pages | Thin: about 220 words, much of it shared between episodes. VideoObject added last week. |
| Sitemaps | 1,000 anime, 49 episodes. No lastmod on anime URLs. |
| Trust pages | Only Privacy. No About, Contact, DMCA or Terms. |
| robots.txt | Cloudflare's managed rules are prepended and block GPTBot, ClaudeBot, Google-Extended and others. Our own file says AI crawlers are welcome, so the two disagree. |
| Bing | Not set up. Bing, DuckDuckGo and Yahoo share an index and are not affected by Google's demotion. |
| Brand | Google autocorrects "animegng" to "animegg". The domain and the name "AnimeGang" don't match, which hurts brand searches. |

## 4. The plan

### Phase 0: unblock (do first)

1. **You:** check Search Console → Security & Manual Actions → Manual actions, and send a screenshot.
2. **Me:** add About, Contact, DMCA and Terms pages, linked in the footer. A DMCA page with a contact address lets rights holders write to you instead of filing with Google, and notices to Google are what demote the site.
3. **Me + you:** set up Bing Webmaster Tools and IndexNow so Bing, DuckDuckGo and Yahoo index new pages within minutes. You create the Bing account and verify the site; I add the key file and the ping.

### Phase 1: home page for the target phrase

1. Visible H1 "Watch Anime Online Free" and a short intro under the hero, for visitors as well as crawlers.
2. An FAQ section of 8 questions at the bottom of the home page, with FAQPage schema. Questions come from real searches: is it free, sub and dub, do I need an account, how often are episodes added, phone support, and so on.
3. Title: "AnimeGang — Watch Anime Online Free in HD | English Sub & Dub". Description rewritten around "watch anime free online".

### Phase 2: new page types (built from data we already have)

| Page | Targets | Count |
|---|---|---|
| `/dub` English dubbed anime | "english dubbed anime", "watch anime online dubbed" | 1 + pagination |
| `/movies` Anime movies | "anime movies", "best anime movies" | 1 + pagination |
| `/az/{letter}` A–Z list | Internal linking; "anime list" | 27 |
| `/anime/{id}/{slug}/similar` "Anime like X" | "anime like solo leveling" | Top 500 titles with at least 6 recommendations |
| `/new` New anime this season, by year | "new anime 2026", "new anime this season" | 1 |
| Retitle `/schedule` and `/browse/latest` | "anime schedule today", "anime episodes released today" | 2 |

Every page has its own data, so none of them is a thin copy of another. Pages with too little data are not created.

### Phase 3: upgrade existing pages

1. **Anime pages:** title "Watch {Title} Online Free — English Sub & Dub | AnimeGang". Add a 4-question FAQ generated from real data (episode count, dub availability, next episode date, watch order), with FAQPage schema.
2. **Episode pages:** title "{Title} Episode {N} English Sub & Dub — Watch Free". More unique content per episode: synopsis, air date, length, previous/next, and links to related episodes. Episodes with no synopsis and no thumbnail are set to noindex so Google spends its crawl on the good ones.
3. **Internal links:** footer hubs for dub, movies, A–Z and new; breadcrumbs on every page.

### Phase 4: technical

1. Sitemaps: anime from 1,000 to 5,000 titles with lastmod; add the new page types; add image tags for covers.
2. Speed: run Lighthouse on home, anime and watch pages and fix what it finds (image sizes, layout shift, JavaScript weight).
3. robots.txt: decide on AI crawlers. Recommended: allow the AI search bots (OAI-SearchBot, PerplexityBot, ChatGPT-User) so ChatGPT and Perplexity can cite you, keep training bots blocked. This is a Cloudflare dashboard setting, so you change it.
4. Validate all structured data with Google's Rich Results Test after each phase.

### Phase 5: off-site (yours; I can draft the text)

1. Get listed where anime viewers look for sites: EverythingMoe, FMHY, theindex.moe, and the wikis of anime piracy subreddits. This is how yomi.to got traffic with 27 backlinks.
2. A Discord server and a subreddit or X account with the same name, so "AnimeGang" becomes a searchable brand.
3. Decide on the brand/domain mismatch: keep pushing "AnimeGang", or use "AnimeGng" everywhere.

### Not doing

- No pages targeting other sites' names ("9anime", "hianime"). Those are trademarked brand terms, and such pages read as doorway pages.
- No keyword stuffing, hidden text or bulk pages with swapped names. All three risk a spam penalty on top of the current demotion.

## 5. What to expect

- Bing, DuckDuckGo and Yahoo: results in 1 to 3 weeks after Phase 0.
- Google long-tail (title, episode, dub, "anime like"): depends on the demotion lifting. If no new notices arrive, weeks to a few months.
- Google head terms ("watch anime free online"): these are held by Tubi, Plex and established pirate brands. Page-one is possible but is a months-long goal that needs brand searches from Phase 5, not just on-page work.
- Risk: more visibility also means more attention from rights holders. The anime episodes are unlicensed, so new notices can undo the gains. The DMCA page in Phase 0 reduces this but doesn't remove it.

## 6. Order of work

Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4, deploying after each. Phase 5 runs alongside.

## Sources

- https://ahrefs.com/websites/9animetv.to
- https://ahrefs.com/websites/aniwatchtv.to
- https://ahrefs.com/websites/yomi.to
- https://ahrefs.com/websites/hianime.to
- https://ahrefs.com/websites/aniwave.to
- Skills read: coreyhaines31 (seo-audit, ai-seo, programmatic-seo), addyosmani (seo), resciencelab (seo-geo), iannuttall (seo), sanity-io (seo-aeo-best-practices), agricidaniel (seo, seo-competitor-pages, seo-content, seo-sitemap). The anthropics seo-audit and aaron-he-zhu seo-content-writer files could not be downloaded.
