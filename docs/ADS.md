# Ads: what we had (removed 2026-11-06)

Adsterra ads were removed completely so they can be reimplemented. This file records the old setup.
The full old code is in git history: see the commit before "Remove Adsterra ads" (`git show HEAD~1:src/components/AdSlot.tsx`).

## Why revenue was $0

The ads were working: about 2.7k impressions over 5 days and 3 clicks, with the right domain sent.
Adsterra support explained it: their **banners are mostly CPA** (cost per action). A banner earns money only when a visitor clicks it **and** completes an action on the advertiser's page.
Few clicks with no actions means a $0 CPM. That isn't a code bug.

Your other site has similar traffic and earns about $0.56 per 1,000 impressions (36k impressions for $20). That's normal for formats that pay per view, such as Social Bar, Popunder, Native or direct links, not for banners.

**For the reimplementation:**
- Choose formats that pay per impression rather than banners. Check which formats earn on the other site in Adsterra's Placement tab.
- Avoid wrapping ads in extra sandboxed iframes where we can. Our banners sat inside our own iframe, which held Adsterra's iframe. Double framing can lower fill and how much an ad is worth.

## Units (Adsterra, registered for animegng.com)

| Unit | Size | Key | Script |
|---|---|---|---|
| Banner | 728x90 | `9ebbacfc3c5f977a3851e4cc47be8646` | `https://bauval.org/22/<key>` (document.write, `atOptions` with format `iframe`) |
| Banner | 320x50 | `5a5915d33036ba0f2e0090007efa224d` | same |
| Banner | 300x250 | `c70fbb0dbd937607126f834d009a108e` | same |
| Native banner (NativeBanner_1, 1:1) | responsive | `092ff557cd6572e90484eab13ffff6d3` | `https://bauval.org/21/<key>` (async, `data-cfasync="false"`, renders into `#container-<key>`) |
| Banner (old pages.dev keys, defined but never placed) | 468x60 | `ed0de7a4bcb36d96f282ef9ca4b9f1ce` | |
| | 160x600 | `a41ce23f0571af075fca48e54a339202` | |
| | 160x300 | `c56e115f3c10d8da72a1e37954006090` | |

## How they were loaded

- `src/components/AdSlot.tsx`:
  - `AdSlot`: one banner in a fixed-size box with an "Advertisement" label.
  - `LeaderboardAd`: 728x90 on desktop (`md` and up), 320x50 on phones.
  - `NativeAdTile`: one native ad as a grid card labelled "Sponsored", hidden until it reports a height.
  - `withNativeAds`: inserts native tiles into grids.
- Each unit was an iframe pointing at our own page, `/ad?k=&w=&h=` (`public/ad.html`) or `/native?k=` (`public/native.html`), so Adsterra saw animegng.com as the referrer.
  - Sandbox: `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`. No top navigation, so ads couldn't redirect the page.
  - Each unit loaded lazily when scrolled within 200–300px.
- `src/components/AdblockCard.tsx`: shown to visitors with an ad blocker.
  - Detection: a bait element plus a HEAD fetch of the 728x90 script with a 2-second timeout.
  - Close button snoozes it for 3 days (`ag:adblock-later`); "I've disabled it" reloads the page.
- Supporting config: `/ad` and `/native` were excluded in `public/_routes.json` and disallowed in `robots.txt` (`worker/seo.js`). The privacy text in `Account.tsx` mentioned Adsterra.

## Placements

| Page | Placement |
|---|---|
| Home | Leaderboard between "Latest episodes" and "Airing this season"; 300x250 in the sidebar between Top 10 and Airing today; 1 native tile in the seasonal grid |
| Anime detail | Leaderboard (`mt-16`); native tiles in the characters grid and the related/recommended grid |
| Watch | Leaderboard under the player area (`mt-10`); native tiles in the episode grid (`EpisodeGrid`) |
| Browse | Native tiles in results (24 per page for latest episodes, 30 otherwise; 3 tiles per page); leaderboard at the bottom |
| Search, Collection | Native tiles (3 per 30); leaderboard at the bottom |
| Manga home | Leaderboard; 1 native tile per 24 in latest |
| Manga browse | 2 native tiles per 32; leaderboard at the bottom |
| Manga detail | Leaderboard (`mb-10`) |
| Manga reader | Leaderboard (`mb-4`) |

The rule throughout was ads only in reserved boxes between content: never over the player, and no popunders or overlays.
