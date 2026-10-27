// Indexable landing pages for a genre (/genre/:slug) or a season (/season/:year/:season).
// Each page's intro is built from live data (counts, top-rated, airing now) so pages differ in
// substance, not just in the name swapped into a template. worker/seo.js renders the same for crawlers.
import { Link, useParams } from "react-router-dom"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { LeaderboardAd, withNativeAds } from "@/components/AdSlot"
import { AnimeCard, CardSkeleton } from "@/components/AnimeCard"
import { Container, Rail, Section, SectionHeader } from "@/components/Section"
import { BlurFade } from "@/components/ui/blur-fade"
import { api, useSearch, type AnimeCard as Card, type Paged } from "@/lib/api"
import { cap, titleOf } from "@/lib/format"
import { animeHref, clip, genreHref, GENRES, slugify, SITE_NAME, useHead } from "@/lib/seo"
import NotFound from "./NotFound"

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"]

function Grid({ params, title }: { params: Record<string, string>; title: string }) {
  const q = useInfiniteQuery({
    queryKey: ["collection", params],
    queryFn: ({ pageParam }) => api<Paged<Card>>(`/search?${new URLSearchParams({ ...params, page: String(pageParam), limit: "30" })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 10 * 60_000,
  })
  const items = q.data?.pages.flatMap((p) => p.results) ?? []
  return (
    <section className="mt-14">
      <SectionHeader title={title} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {q.isLoading ? Array.from({ length: 18 }, (_, n) => <CardSkeleton key={n} />) : withNativeAds(items.map((a) => <AnimeCard key={a.id} anime={a} />))}
      </div>
      <LeaderboardAd className="mt-12" />
      {q.hasNextPage && (
        <div className="mt-10 flex justify-center">
          <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-8 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10">
            {q.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </section>
  )
}

function Shelf({ title, items }: { title: string; items?: Card[] }) {
  if (!items?.length) return null
  return (
    <Section className="mt-12">
      <SectionHeader title={title} />
      <Rail>
        {items.map((a) => (
          <div key={a.id} className="w-[42vw] shrink-0 snap-start sm:w-[190px]">
            <AnimeCard anime={a} />
          </div>
        ))}
      </Rail>
    </Section>
  )
}

function Pills({ links, active }: { links: [string, string][]; active: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {links.map(([label, to]) => (
        <Link key={to} to={to} className={to === active ? "rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-[13px] text-white" : "rounded-full border border-white/10 px-3 py-1.5 text-[13px] text-white/60 transition hover:border-white/25 hover:text-white"}>
          {label}
        </Link>
      ))}
    </div>
  )
}

export function GenrePage() {
  const slug = useParams().slug ?? ""
  const g = GENRES.find((x) => slugify(x) === slug)
  const top = useSearch({ genre: g ?? "", sort: "score_desc", limit: 12 }, !!g)
  const airing = useSearch({ genre: g ?? "", status: "RELEASING", sort: "popularity_desc", limit: 12 }, !!g)
  const all = useSearch({ genre: g ?? "", sort: "popularity_desc", limit: 1 }, !!g)
  const best = top.data?.results[0]
  const count = all.data?.total
  const intro = g
    ? `${SITE_NAME} lists ${count == null ? "hundreds of" : count >= 5000 ? "thousands of" : count.toLocaleString()} ${g.toLowerCase()} anime.${best ? ` The highest-rated is ${titleOf(best.title)}${best.average_score ? ` (${(best.average_score / 10).toFixed(1)}/10)` : ""}.` : ""}${airing.data?.results.length ? ` ${airing.data.results.length >= 12 ? "Many" : airing.data.results.length} ${g.toLowerCase()} anime are airing right now, including ${titleOf(airing.data.results[0].title)}.` : ""}`
    : ""

  useHead({ title: g ? `Best ${g} Anime — Watch Free Online | ${SITE_NAME}` : undefined, description: clip(`${intro} Watch ${g?.toLowerCase()} anime free in HD with sub and dub.`), path: `/genre/${slug}` })
  if (!g) return <NotFound />

  return (
    <div className="pt-24">
      <Container>
        <BlurFade>
          <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Genre</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Best {g} anime</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/60">{intro}</p>
        </BlurFade>
        <Pills links={GENRES.map((x) => [x, genreHref(x)])} active={`/genre/${slug}`} />
        <Shelf title={`Top rated ${g.toLowerCase()} anime`} items={top.data?.results} />
        <Shelf title={`${g} anime airing now`} items={airing.data?.results} />
        <Grid params={{ genre: g, sort: "popularity_desc" }} title={`Most popular ${g.toLowerCase()} anime`} />
      </Container>
    </div>
  )
}

export function SeasonPage() {
  const params = useParams()
  const year = Number(params.year)
  const S = String(params.season ?? "").toUpperCase()
  const valid = SEASONS.includes(S) && year >= 1960 && year <= new Date().getFullYear() + 1
  const head = useSearch({ season: S, year, sort: "popularity_desc", limit: 3 }, valid)
  const label = `${cap(S)} ${year}`
  const top3 = head.data?.results.map((a) => titleOf(a.title)) ?? []
  const intro = head.data ? `${head.data.total} anime premiered in ${label}${top3.length ? `. The most popular include ${top3.join(", ")}` : ""}.` : ""

  useHead({ title: valid ? `${label} Anime Season — Full List | ${SITE_NAME}` : undefined, description: clip(`All anime from the ${label} season, sorted by popularity. ${intro} Watch free with sub and dub.`), path: `/season/${year}/${S.toLowerCase()}` })
  if (!valid) return <NotFound />

  // Neighbouring seasons for internal linking.
  const around: [string, string][] = []
  for (let i = -3; i <= 3; i++) {
    const idx = SEASONS.indexOf(S) + i
    const y = year + Math.floor(idx / 4)
    const s = SEASONS[((idx % 4) + 4) % 4]
    if (y <= new Date().getFullYear() + 1) around.push([`${cap(s)} ${y}`, `/season/${y}/${s.toLowerCase()}`])
  }

  return (
    <div className="pt-24">
      <Container>
        <BlurFade>
          <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Season</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{label} anime</h1>
          {intro && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/60">{intro}</p>}
          {head.data?.results[0] && (
            <p className="mt-2 text-sm text-white/45">
              Start with <Link className="text-primary hover:underline" to={animeHref(head.data.results[0])}>{titleOf(head.data.results[0].title)}</Link>.
            </p>
          )}
        </BlurFade>
        <Pills links={around} active={`/season/${year}/${S.toLowerCase()}`} />
        <Grid params={{ season: S, year: String(year), sort: "popularity_desc" }} title={`All ${label} anime by popularity`} />
      </Container>
    </div>
  )
}
