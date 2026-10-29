import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { BookOpen, Search, X } from "lucide-react"
import { MangaCard, MangaCardSkeleton } from "@/components/MangaCard"
import { Container, Rail, Section, SectionHeader } from "@/components/Section"
import { mangaHref, readHref, removeMangaProgress, useMangaHome, useMangaProgress } from "@/lib/manga"
import { useHead } from "@/lib/seo"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8"

export default function MangaHome() {
  useHead({
    title: "MangaGang — Read Manga Online Free",
    description: "Read manga, manhwa and manhua online free on MangaGang: popular series, the latest chapter updates and a fast long-strip reader.",
    path: "/manga",
  })
  const { data, isLoading, error } = useMangaHome()
  const spotlight = data?.popular[0]

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/[0.06] pt-28 pb-14 sm:pt-32">
        {spotlight && <img src={spotlight.cover_large} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="absolute -top-32 -left-32 size-[30rem] rounded-full bg-primary/15 blur-[120px]" />
        <Container className="relative">
          <img src="/mangagang-logo.webp" alt="MangaGang" width={444} height={96} className="h-12 w-auto sm:h-16" />
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
            Read manga, manhwa and manhua free. Thousands of series, new chapters every day, and a reader built for long scrolls.
          </p>
          <MangaSearchBox className="mt-7 max-w-xl" />
        </Container>
      </section>

      <Container className="mt-12 space-y-14">
        {error && <p className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">Manga data is temporarily unavailable. Please try again shortly.</p>}

        <ContinueReading />

        <Section>
          <SectionHeader eyebrow="Most read" title="Popular Manga" href="/manga/browse?sort=popular" />
          <Rail>
            {(data?.popular.slice(0, 12) ?? Array.from({ length: 8 })).map((m, n) => (
              <div key={m ? m.id : n} className="w-[42vw] shrink-0 snap-start sm:w-[190px]">
                {m ? <MangaCard manga={m} rank={n + 1} /> : <MangaCardSkeleton />}
              </div>
            ))}
          </Rail>
        </Section>

        <Section>
          <SectionHeader eyebrow="Fresh chapters" title="Latest Updates" href="/manga/browse?sort=latest" />
          <div className={GRID}>
            {isLoading ? Array.from({ length: 16 }, (_, n) => <MangaCardSkeleton key={n} />) : data?.latest.slice(0, 24).map((m) => <MangaCard key={m.id} manga={m} />)}
          </div>
        </Section>

        <Section>
          <SectionHeader eyebrow="Fan favourites" title="More Popular Series" href="/manga/browse?sort=popular&page=2" />
          <div className={GRID}>
            {isLoading ? Array.from({ length: 8 }, (_, n) => <MangaCardSkeleton key={n} />) : data?.popular.slice(12).map((m) => <MangaCard key={m.id} manga={m} />)}
          </div>
        </Section>
      </Container>
    </>
  )
}

export function MangaSearchBox({ initial = "", className }: { initial?: string; className?: string }) {
  const [q, setQ] = useState(initial)
  const navigate = useNavigate()
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        navigate(`/manga/browse?${new URLSearchParams(q.trim() ? { q: q.trim() } : { sort: "popular" })}`)
      }}
    >
      <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 backdrop-blur-md transition focus-within:border-primary/60">
        <Search className="size-4 shrink-0 text-white/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search manga, manhwa, authors…"
          aria-label="Search manga"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
        />
        <button type="submit" className="h-8 shrink-0 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
          Search
        </button>
      </label>
    </form>
  )
}

function ContinueReading() {
  const progress = useMangaProgress()
  if (!progress.length) return null
  return (
    <Section>
      <SectionHeader eyebrow="Pick up where you left off" title="Continue Reading" />
      <Rail>
        {progress.map((p) => (
          <div key={p.series.id} className="group/cr relative w-[64vw] shrink-0 snap-start sm:w-[300px]">
            <div className="flex gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]">
              <Link to={readHref(p.series.id, p.chapterId)} className="shrink-0" tabIndex={-1} aria-hidden>
                <img src={p.series.cover} alt="" loading="lazy" className="h-24 w-16 rounded-lg object-cover" />
              </Link>
              <div className="min-w-0 py-1">
                <Link to={readHref(p.series.id, p.chapterId)} className="line-clamp-2 text-sm font-semibold text-white hover:underline">
                  {p.series.title}
                </Link>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <BookOpen className="size-3.5" />
                  {p.chapterName}
                </p>
                <Link to={mangaHref(p.series)} className="mt-1 block text-[11px] text-white/45 hover:text-white">
                  All chapters
                </Link>
              </div>
            </div>
            <button
              onClick={() => removeMangaProgress(p.series.id)}
              aria-label="Remove from history"
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white/70 opacity-0 backdrop-blur transition group-hover/cr:opacity-100 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </Rail>
    </Section>
  )
}
