import { lazy, startTransition, Suspense, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { genreHref, SITE_NAME, useHead } from "@/lib/seo"
import { AdSlot, LeaderboardAd, withNativeAds } from "@/components/AdSlot"
import { WatchLink } from "@/components/WatchLink"
import { Play, X } from "lucide-react"
import { HeroSpotlight } from "@/components/HeroSpotlight"
import { AnimeCard, CardSkeleton, EpisodeCard } from "@/components/AnimeCard"
import { Container, Rail, Section, SectionHeader, WhenVisible } from "@/components/Section"
import { AiringToday, TopTen } from "@/components/Sidebar"
import { Marquee } from "@/components/ui/marquee"
import { useHome } from "@/lib/api"
import { cap, titleOf } from "@/lib/format"
import { removeHistory, useHistory } from "@/lib/progress"

const ScheduleBanner = lazy(() => import("@/components/ScheduleBanner"))

// Everything below the hero renders once the page has loaded (hero image included), as a low-priority
// time-sliced update: the hero paints first, its image doesn't share bandwidth with the card images, and the
// rest of the page never blocks the main thread in one long task.
function useAfterLoad() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let id = 0
    const go = () => (id = requestAnimationFrame(() => startTransition(() => setReady(true))))
    if (document.readyState === "complete") go()
    else addEventListener("load", go, { once: true })
    return () => {
      removeEventListener("load", go)
      cancelAnimationFrame(id)
    }
  }, [])
  return ready
}

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Mahou Shoujo"]

export default function Home() {
  useHead({
    title: `${SITE_NAME} — Watch Anime Online Free in HD (Sub & Dub)`,
    description: "Watch anime online free in HD with English sub and dub. Browse trending, seasonal and top-rated anime, episode guides and the weekly airing schedule on AnimeGang.",
    path: "/",
  })
  const { data, isLoading, error } = useHome()
  const ready = useAfterLoad()

  return (
    <>
      <HeroSpotlight items={data?.trending ?? []} />

      <div className="relative z-10 -mt-6 border-y border-white/[0.06] bg-background/60 py-3 backdrop-blur-md">
        <Marquee pauseOnHover repeat={2} className="[--duration:45s] [--gap:0.75rem]">
          {GENRES.map((g) => (
            <Link
              key={g}
              to={genreHref(g)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium whitespace-nowrap text-white/60 transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
            >
              {g}
            </Link>
          ))}
        </Marquee>
      </div>

      {!ready ? <div className="min-h-screen" /> : <Container className="mt-12 space-y-14">
        {error && <p className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">Anime data is temporarily unavailable. Please try again shortly.</p>}

        <ContinueWatching />

        <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-14">
            <Section>
              <SectionHeader eyebrow="Fresh drops" title="Latest Episodes" href="/browse/latest" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? Array.from({ length: 9 }, (_, n) => <CardSkeleton key={n} landscape />) : data?.latest_aired.slice(0, 9).map((e) => <EpisodeCard key={`${e.anime.id}-${e.episode}`} item={e} />)}
              </div>
            </Section>

            <LeaderboardAd />

            <Section>
              <SectionHeader eyebrow={data ? `${cap(data.season.season)} ${data.season.year}` : "This season"} title="Airing This Season" href="/browse/seasonal" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-6">
                {isLoading ? Array.from({ length: 12 }, (_, n) => <CardSkeleton key={n} />) : withNativeAds((data?.seasonal ?? []).map((a) => <AnimeCard key={a.id} anime={a} />), 12, 1)}
              </div>
            </Section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <TopTen />
            <AdSlot size="300x250" />
            <AiringToday />
          </aside>
        </div>

        <Section>
          <SectionHeader eyebrow="Hall of fame" title="Top Rated of All Time" href="/browse/top" />
          <Rail>
            {(data?.top_rated ?? Array.from({ length: 8 })).map((a, n) => (
              <div key={a ? a.id : n} className="w-[42vw] shrink-0 snap-start sm:w-[200px]">
                {a ? <AnimeCard anime={a} rank={n + 1} /> : <CardSkeleton />}
              </div>
            ))}
          </Rail>
        </Section>

        <WhenVisible minHeight={260}>
          <Suspense fallback={<div className="min-h-[260px]" />}>
            <ScheduleBanner />
          </Suspense>
        </WhenVisible>

        <Section>
          <SectionHeader eyebrow="Coming soon" title="Most Anticipated" href="/browse/upcoming" />
          <Rail>
            {(data?.upcoming ?? Array.from({ length: 8 })).map((a, n) => (
              <div key={a ? a.id : n} className="w-[42vw] shrink-0 snap-start sm:w-[200px]">
                {a ? <AnimeCard anime={a} /> : <CardSkeleton />}
              </div>
            ))}
          </Rail>
        </Section>
      </Container>}
    </>
  )
}

function ContinueWatching() {
  const history = useHistory()
  if (!history.length) return null
  return (
    <Section>
      <SectionHeader eyebrow="Pick up where you left off" title="Continue Watching" />
      <Rail>
        {history.map((h) => (
          <div key={h.anime.id} className="group/cw relative w-[78vw] shrink-0 snap-start sm:w-[320px]">
            <WatchLink to={`/watch/${h.anime.id}/${h.episode}`} className="block">
              <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
                <img src={h.thumbnail ?? h.anime.banner_image ?? h.anime.cover_image.large} alt="" className="size-full object-cover transition duration-700 group-hover/cw:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover/cw:opacity-100">
                  <span className="grid size-12 place-items-center rounded-full bg-primary">
                    <Play className="ml-0.5 size-5 fill-white" />
                  </span>
                </div>
                <div className="absolute right-3 bottom-3 left-3">
                  <p className="text-[11px] font-semibold text-primary">EPISODE {h.episode}</p>
                  <p className="line-clamp-1 text-sm font-semibold">{titleOf(h.anime.title)}</p>
                  {h.episodeTitle && <p className="line-clamp-1 text-xs text-white/50">{h.episodeTitle}</p>}
                </div>
                {h.anime.episodes ? (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                    <div className="h-full bg-gradient-to-r from-brand-red to-brand-blue" style={{ width: `${Math.min(100, (h.episode / h.anime.episodes) * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            </WatchLink>
            <button
              onClick={() => removeHistory(h.anime.id)}
              aria-label="Remove from history"
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white/70 opacity-0 backdrop-blur transition group-hover/cw:opacity-100 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </Rail>
    </Section>
  )
}
