import { Link } from "react-router-dom"
import { Logo, MANGA_NAV, NAV, useIsManga } from "@/components/Navbar"
import { DotPattern } from "@/components/ui/dot-pattern"
import { GENRES, genreHref } from "@/lib/seo"

const SEASONS = ["winter", "spring", "summer", "fall"]

// The current season and the five before it, for internal links to season pages.
function recentSeasons() {
  const d = new Date()
  let y = d.getFullYear()
  let i = Math.floor(d.getMonth() / 3)
  const out: [string, string][] = []
  for (let n = 0; n < 6; n++) {
    out.push([`${SEASONS[i][0].toUpperCase()}${SEASONS[i].slice(1)} ${y}`, `/season/${y}/${SEASONS[i]}`])
    if (--i < 0) {
      i = 3
      y--
    }
  }
  return out
}

export function Footer() {
  const manga = useIsManga()
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-white/[0.06]">
      <DotPattern className="text-white/[0.06] [mask-image:radial-gradient(500px_circle_at_top,white,transparent)]" />
      <div className="absolute -top-40 left-1/2 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-brand-red/10 blur-[120px]" />
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-10 px-4 py-14 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-10">
        <div className="max-w-sm">
          <Logo className="h-9" />
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            {manga
              ? "Read manga, manhwa and manhua free. MangaGang is AnimeGang's manga section and doesn't store any files on its servers."
              : "Stream anime in HD with sub and dub. Episode data comes from AniList and ani.zip. AnimeGang doesn't store any files on its servers."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm sm:grid-cols-3">
          {(manga ? MANGA_NAV : NAV).map((n) => (
            <Link key={n.to} to={n.to} className="text-white/55 transition hover:text-white">
              {n.label}
            </Link>
          ))}
          <Link to="/browse/upcoming" className="text-white/55 transition hover:text-white">Upcoming</Link>
          <Link to="/browse/popular" className="text-white/55 transition hover:text-white">Most Popular</Link>
          <Link to="/browse/airing" className="text-white/55 transition hover:text-white">Airing Now</Link>
        </div>
      </div>
      <div className="relative mx-auto grid max-w-[1600px] gap-8 border-t border-white/[0.06] px-4 py-8 text-[13px] sm:px-6 lg:grid-cols-[2fr_1fr] lg:px-10">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-widest text-white/35 uppercase">Anime by genre</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {GENRES.map((g) => (
              <Link key={g} to={genreHref(g)} className="text-white/50 transition hover:text-white">
                {g} anime
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-widest text-white/35 uppercase">Anime by season</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {recentSeasons().map(([label, to]) => (
              <Link key={to} to={to} className="text-white/50 transition hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/[0.06] py-5 text-center text-xs text-white/35">
        © {new Date().getFullYear()} AnimeGang. A fun side project. · <Link to="/privacy" className="hover:text-white">Privacy</Link>
      </div>
    </footer>
  )
}
