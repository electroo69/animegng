import { useEffect, useMemo, useState } from "react"
import { LeaderboardAd, withNativeAds } from "@/components/AdSlot"
import { useSearchParams } from "react-router-dom"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2, Minus, Plus, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react"
import { AnimeCard, CardSkeleton } from "@/components/AnimeCard"
import { Container } from "@/components/Section"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlurFade } from "@/components/ui/blur-fade"
import { api, useFacets, type AnimeCard as Card, type Paged } from "@/lib/api"
import { cn } from "@/lib/utils"

type Opt = { value: string; label: string }
const ANY = "any"
const FORMATS: Opt[] = [{ value: ANY, label: "Any format" }, ...["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT"].map((v) => ({ value: v, label: v === "TV_SHORT" ? "TV Short" : v === "MOVIE" ? "Movie" : v === "SPECIAL" ? "Special" : v }))]
const STATUSES: Opt[] = [
  { value: ANY, label: "Any status" },
  { value: "RELEASING", label: "Airing" },
  { value: "FINISHED", label: "Finished" },
  { value: "NOT_YET_RELEASED", label: "Upcoming" },
]
const SEASONS: Opt[] = [{ value: ANY, label: "Any season" }, ...["WINTER", "SPRING", "SUMMER", "FALL"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))]
const thisYear = new Date().getFullYear() + 1
const YEARS: Opt[] = [{ value: ANY, label: "Any year" }, ...Array.from({ length: thisYear - 1969 }, (_, n) => String(thisYear - n)).map((y) => ({ value: y, label: y }))]
const SORTS: Opt[] = [
  { value: ANY, label: "Best match" },
  { value: "popularity_desc", label: "Most popular" },
  { value: "score_desc", label: "Highest rated" },
  { value: "trending_desc", label: "Trending" },
  { value: "year_desc", label: "Newest" },
  { value: "year_asc", label: "Oldest" },
  { value: "title_asc", label: "Title A–Z" },
  { value: "favourites_desc", label: "Most favourited" },
]

const PAGE = 30

export default function Search() {
  const [sp, setSp] = useSearchParams()
  const [text, setText] = useState(sp.get("q") ?? "")
  const [showFilters, setShowFilters] = useState(true)
  const facets = useFacets()

  const params = useMemo(() => Object.fromEntries([...sp.entries()].filter(([, v]) => v)), [sp])
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp)
    if (v && v !== ANY) next.set(k, v)
    else next.delete(k)
    setSp(next, { replace: true })
  }

  useEffect(() => {
    setText(sp.get("q") ?? "")
  }, [sp])
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== (sp.get("q") ?? "")) set("q", text.trim() || null)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const query = useInfiniteQuery({
    queryKey: ["search-inf", params],
    queryFn: ({ pageParam }) => api<Paged<Card>>(`/search?${new URLSearchParams({ ...params, page: String(pageParam), limit: String(PAGE) })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 10 * 60_000,
  })
  const results = query.data?.pages.flatMap((p) => p.results) ?? []

  // Genres cycle: off -> include -> exclude -> off.
  const genreState = useMemo(() => {
    const m = new Map<string, "in" | "out">()
    for (const g of (sp.get("genre") ?? "").split(",").filter(Boolean)) m.set(g.replace(/^-/, ""), g.startsWith("-") ? "out" : "in")
    return m
  }, [sp])
  const cycleGenre = (g: string) => {
    const m = new Map(genreState)
    const s = m.get(g)
    if (!s) m.set(g, "in")
    else if (s === "in") m.set(g, "out")
    else m.delete(g)
    set("genre", [...m].map(([k, v]) => (v === "out" ? `-${k}` : k)).join(",") || null)
  }

  const genres = (facets.data?.genres ?? []).filter((g) => g !== "Hentai")
  const activeCount = [...sp.keys()].filter((k) => k !== "q").length
  const heading = sp.get("q") ? `Results for “${sp.get("q")}”` : sp.get("genre") && genreState.size === 1 ? [...genreState.keys()][0] : sp.get("tag") ? sp.get("tag") : "Browse anime"

  return (
    <div className="pt-24">
      <Container>
        <BlurFade>
          <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Discover</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{heading}</h1>
        </BlurFade>

        <div className="mt-6 flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/35" />
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search by title…"
              className="h-13 w-full rounded-2xl border border-white/10 bg-white/[0.04] pr-4 pl-12 text-base outline-none transition placeholder:text-white/30 focus:border-primary/60 focus:bg-white/[0.06]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn("flex h-13 items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-semibold transition hover:bg-white/[0.06]", showFilters && "border-primary/50 bg-primary/10")}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px]">{activeCount}</span>}
          </button>
        </div>

        {showFilters && (
          <BlurFade className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Filter value={sp.get("sort") ?? ANY} options={SORTS} onChange={(v) => set("sort", v)} />
              <Filter value={sp.get("format") ?? ANY} options={FORMATS} onChange={(v) => set("format", v)} />
              <Filter value={sp.get("status") ?? ANY} options={STATUSES} onChange={(v) => set("status", v)} />
              <Filter value={sp.get("season") ?? ANY} options={SEASONS} onChange={(v) => set("season", v)} />
              <Filter value={sp.get("year") ?? ANY} options={YEARS} onChange={(v) => set("year", v)} />
            </div>
            <div className="mt-5">
              <p className="mb-2.5 text-xs text-white/40">Genres: click once to include, twice to exclude</p>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => {
                  const s = genreState.get(g)
                  return (
                    <button
                      key={g}
                      onClick={() => cycleGenre(g)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition",
                        !s && "border-white/10 text-white/60 hover:border-white/25 hover:text-white",
                        s === "in" && "border-primary bg-primary/15 text-white",
                        s === "out" && "border-white/10 bg-white/[0.03] text-white/35 line-through",
                      )}
                    >
                      {s === "in" && <Plus className="size-3" />}
                      {s === "out" && <Minus className="size-3" />}
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
            {(activeCount > 0 || sp.get("tag")) && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                {sp.get("tag") && (
                  <button onClick={() => set("tag", null)} className="flex items-center gap-1 rounded-full bg-brand-blue/20 px-3 py-1 text-xs text-[#b3c0ff]">
                    Tag: {sp.get("tag")} <X className="size-3" />
                  </button>
                )}
                <button onClick={() => setSp(sp.get("q") ? { q: sp.get("q")! } : {}, { replace: true })} className="ml-auto text-xs font-medium text-white/50 hover:text-white">
                  Clear all filters
                </button>
              </div>
            )}
          </BlurFade>
        )}

        <div className="mt-8 mb-4 flex items-center justify-between text-sm text-white/45">
          <span>{query.data ? (query.data.pages[0].total >= 5000 ? "5,000+ titles" : `${query.data.pages[0].total.toLocaleString()} titles`) : " "}</span>
          {query.isFetching && <Loader2 className="size-4 animate-spin" />}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {query.isLoading ? Array.from({ length: 18 }, (_, n) => <CardSkeleton key={n} />) : withNativeAds(results.map((a) => <AnimeCard key={a.id} anime={a} />))}
        </div>
        {!query.isLoading && !results.length && (
          <div className="py-24 text-center">
            <p className="text-lg font-semibold">Nothing found</p>
            <p className="mt-1 text-sm text-white/45">Try a different title or loosen the filters.</p>
          </div>
        )}
        <LeaderboardAd className="mt-12" />
        {query.hasNextPage && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-8 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10"
            >
              {query.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
              Load more
            </button>
          </div>
        )}
      </Container>
    </div>
  )
}

function Filter({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))} items={options}>
      <SelectTrigger className="h-10! w-full rounded-xl border-white/10 bg-white/[0.04] text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80 border border-white/10 bg-popover/95 backdrop-blur-xl" alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
