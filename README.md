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
