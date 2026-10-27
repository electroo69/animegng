import { useParams } from "react-router-dom"
import { SITE_NAME, useHead } from "@/lib/seo"
import { LeaderboardAd, withNativeAds } from "@/components/AdSlot"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { AnimeCard, CardSkeleton, EpisodeCard } from "@/components/AnimeCard"
import { Container } from "@/components/Section"
import { BlurFade } from "@/components/ui/blur-fade"
import { api, type AiredItem, type AnimeCard as Card, type Paged } from "@/lib/api"
import NotFound from "./NotFound"

// seo: page title and description, matching worker/seo.js.
const KINDS: Record<string, { title: string; eyebrow: string; seo: [string, string] }> = {
  trending: { title: "Trending Now", eyebrow: "What everyone's watching", seo: ["Trending Anime", "The anime everyone is watching right now, updated daily from AniList trends."] },
  popular: { title: "Most Popular", eyebrow: "All-time favourites", seo: ["Most Popular Anime of All Time", "The most-watched anime ever, ranked by AniList members."] },
  top: { title: "Top Rated", eyebrow: "Hall of fame", seo: ["Top Rated Anime of All Time", "The highest-rated anime of all time, ranked by average AniList score."] },
  upcoming: { title: "Upcoming", eyebrow: "Coming soon", seo: ["Upcoming Anime", "The most anticipated anime that have not started airing yet."] },
  seasonal: { title: "This Season", eyebrow: "Currently airing", seo: ["Anime Airing This Season", "Every anime airing this season, sorted by popularity."] },
  airing: { title: "Airing Now", eyebrow: "On air", seo: ["Currently Airing Anime", "Anime with new episodes airing every week."] },
  latest: { title: "Latest Episodes", eyebrow: "Fresh drops", seo: ["Latest Anime Episodes", "The newest anime episodes released, updated as they air."] },
}

export default function Browse() {
  const kind = useParams().kind ?? ""
  const meta = KINDS[kind]
  const latest = kind === "latest"
  const q = useInfiniteQuery({
    queryKey: ["browse", kind],
    queryFn: ({ pageParam }) => api<Paged<Card | AiredItem>>(latest ? `/latest-aired?page=${pageParam}&limit=24` : `/list/${kind}?page=${pageParam}&limit=30`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    enabled: !!meta,
    staleTime: 10 * 60_000,
  })
  useHead({ title: meta ? `${meta.seo[0]} | ${SITE_NAME}` : undefined, description: meta ? `${meta.seo[1]} Watch free in HD with sub and dub on ${SITE_NAME}.` : undefined, path: `/browse/${kind}` })
  if (!meta) return <NotFound />
  const items = q.data?.pages.flatMap((p) => p.results) ?? []

  return (
    <div className="pt-24">
      <Container>
        <BlurFade>
          <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">{meta.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>
        </BlurFade>
        {latest ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {q.isLoading ? Array.from({ length: 12 }, (_, n) => <CardSkeleton key={n} landscape />) : (items as AiredItem[]).map((e) => <EpisodeCard key={`${e.anime.id}-${e.episode}`} item={e} />)}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {q.isLoading ? Array.from({ length: 18 }, (_, n) => <CardSkeleton key={n} />) : withNativeAds((items as Card[]).map((a, n) => <AnimeCard key={a.id} anime={a} rank={kind === "top" || kind === "trending" ? n + 1 : undefined} />))}
          </div>
        )}
        <LeaderboardAd className="mt-12" />
        {q.hasNextPage && (
          <div className="mt-10 flex justify-center">
            <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-8 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10">
              {q.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
              Load more
            </button>
          </div>
        )}
      </Container>
    </div>
  )
}
