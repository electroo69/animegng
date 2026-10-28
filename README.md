# AnimeGang

The website for the local anime API. Built with React, Vite, Tailwind v4,
[Magic UI](https://magicui.design) and shadcn/ui. Dark theme in the logo's red (#FD0000) and blue (#001AFE).

## Run

It needs the API from `../api without reanime` running on port 3001. Open two terminals:

```powershell
cd "api without reanime"; npm start
```

```powershell
cd animegang-web; npm run dev
```

Then open http://localhost:5173. Vite proxies `/api/*` to `http://localhost:3001`. To point it
at another API, set `$env:API_URL="http://host:port"` before `npm run dev`.

## Pages

| Route | What's there |
|---|---|
| `/` | Spotlight hero (auto-rotating, TVDB logos), genre marquee, continue watching, latest episodes, this season, Top 10 (trending / popular / all-time), airing today, top rated, weekly count, upcoming |
| `/anime/:id` | Banner, poster, stats, synopsis, trailer, tabs for episodes (thumbnails, search, 100-episode ranges, grid/list), characters & voice actors, related, details/tags/links, recommendations |
| `/watch/:id/:ep` | Player, sub/dub server switch, autoplay / auto-next / skip intro / skip outro, lights-off, prev/next, episode panel, next-airing countdown |
| `/search` | Live text search with filters synced to the URL: sort, format, status, season, year, and genre include/exclude chips |
| `/schedule` | Weekly calendar in your timezone, with live countdowns |
| `/browse/:kind` | `trending`, `popular`, `top`, `seasonal`, `upcoming`, `airing`, `latest` |

Press `Ctrl K` or `/` anywhere to search.

## Notes

- The player iframe is sandboxed without `allow-top-navigation` or `allow-popups`. Without that,
  the video host's ads can redirect the whole page.
- Watch history, resume points and player settings are stored in `localStorage`.
- Auto-next uses the player's `playerStatus` messages. HD-1 and HD-2 don't send time updates, so
  resuming partway through an episode only works on servers that do.

## Production: Cloudflare website + Vercel API

- Website: https://animegng.com (animegng.pages.dev redirects there; Pages build: `npm run build`, output: `dist`).
- API: https://animegng-api.vercel.app/api (Vercel project `animegng-api`).
- Pages Functions and the optional Cloudflare Worker forward `/api/*` to Vercel.
  `worker/proxy.js` defaults to this API origin; `API_ORIGIN` can override it.
- `api/index.js` adapts the shared API in `worker/app.js` to Vercel's Node.js runtime.
  Explicit rewrites preserve nested paths and query parameters.
- Successful public responses use CDN caching. Errors and video-provider failures are
  not cached. Per-instance caches are optimizations, not durable storage or a global rate limiter.
- Video servers still depend on reanime. If it rejects server requests, the watch page
  retains episode details and shows a provider-unavailable message; metadata hosting
  does not guarantee video availability.

Validate with `node --test tests/*.test.mjs` and `npm run build`.
Deploy the API from this directory with `vercel deploy --prod`, then deploy the site
with `npx wrangler pages deploy dist --project-name animegng --branch main`.
The optional Worker uses `npx wrangler deploy`.

### Verified direct embeds

`worker/embed-links.js` stores explicitly verified AniList ID → episode → sub/dub
embed URLs, with source and verification date. Currently it covers **One Piece (21),
episode 1 only**. Add new entries only after verifying the exact title, episode and
language; IDs cannot be derived from the anime ID. Redeploy Cloudflare after edits.
For mapped watch routes Cloudflare fetches only anime/episode metadata from Vercel,
and the browser loads the stored iframe URL directly. `/api/servers/:id/:ep` also
serves the mapped list locally. Unmapped episodes retain the existing provider flow.
Embed availability is controlled by the third-party host and is not guaranteed by a
successful API response. Vercel remains required for metadata.

### Automatic catalog synchronization

Run `node scripts/backfill-catalog.mjs` for the full import. It enumerates every
public catalog page before backfilling episodes, rotating between titles so a long
series cannot monopolize the import. The source currently reports 20,811 catalog
entries; this is not a count of playable titles. Titles without an explicit AniList
ID or episode count are recorded as skipped, and empty server lists never create
fake playback links.

The runner continues in 200-request batches, at least 1.2 seconds between requests.
It publishes the first changed batch and subsequent changes at most once an hour to
the existing Cloudflare Pages project and Worker. Build/deployment errors, source
code edits, HTTP errors, blocks, and invalid data stop it for review. It never
retries access blocks. Keep the computer awake and online during the import.
Progress is in `.wrangler/backfill-status.json`; output goes to the launcher's logs.

`.embed-catalog.json` records the discovered titles and pagination cursor;
`.embed-sync-state.json` records the round-robin queue, completed and skipped titles,
and recent attempts. Checkpoints are saved every 20 processed jobs and on normal
exit; mappings are saved immediately. Lock files prevent simultaneous writers.
After a hard crash, confirm the recorded PID is no longer running before removing
a stale lock. Never remove a live process's lock.

`node scripts/sync-embeds.mjs --catalog-only` discovers catalog pages without fetching
video links. Without that option, the script prioritizes recent episodes and
continues the backfill. Its default request cap is 100; `SYNC_MAX_REQUESTS` can raise
it to 200. The six-hour Codex heartbeat monitors the full import and handles new
releases after it finishes; it must never overlap the background runner.

Mappings live in `public/embeds/<anilist-id>.json` as static assets. They contain only
provider-returned HTTPS FlixCloud URLs. A successful response is not an individual
playback test. Full catalog discovery does not imply full playable coverage.

## Accounts & community

Accounts, synced history, playlists, subscriptions, likes, comments, live comments and watch
parties run in the Worker (`worker/social/`), backed by the D1 database `animegng`
(`migrations/`) and a `PartyRoom` Durable Object per watch party. The Pages site forwards
`/api/u/*` (WebSockets included) to the Worker, so the session cookie stays on animegng.com.

- **Schema changes:** add a file to `migrations/`, then `npx wrangler d1 migrations apply animegng --remote`.
- **Deploying the Worker:** `npx wrangler deploy` (Pages deploys itself on push).
- **Google / Discord sign-in:** create OAuth apps with redirect URI
  `https://animegng.com/api/u/auth/google/callback` (or `/discord/callback`), then
  `npx wrangler secret put GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (same for `DISCORD_`).
  The buttons appear automatically once both are set.
- **Make someone an admin** (can delete any comment, ban users):
  `npx wrangler d1 execute animegng --remote --command "UPDATE users SET is_admin = 1 WHERE username = 'NAME'"`
- **New-episode notifications** run hourly (cron `7 * * * *`): in-app, browser push (VAPID key in the
  `VAPID_PRIVATE_JWK` secret) and email.
- **Email** (sign-up confirmation, password reset, sign-in links, episode emails) is sent with
  [Resend](https://resend.com) from `noreply@animegng.com`: verify the domain in Resend and set the
  `RESEND_API_KEY` secret (`npx wrangler secret put RESEND_API_KEY`). Override the sender with `EMAIL_FROM`.
- **Rate limits:** sign-up 5/hour per IP; login 10 per 15 min per IP and 20 per account; email links 3/hour.
  The Pages proxy passes the visitor IP with the `PROXY_SECRET` shared secret (set on both projects).
- **Watch parties** accept guests (no account) with a display name; guests can watch, chat and react.
- **Local development:** `npx wrangler d1 migrations apply animegng --local`, run `npx wrangler dev --port 8787 --local`,
  then the site with `SOCIAL_URL=http://localhost:8787` so test accounts stay in the local database.
