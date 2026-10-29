import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowDownUp, BadgeCheck, Bookmark, BookOpen, ListPlus, Search, Tv } from "lucide-react"
import { LeaderboardAd } from "@/components/AdSlot"
import { Container } from "@/components/Section"
import { mangaHref, readHref, toggleShelf, useMangaProgress, useMangaSeries, useMangaShelves, type MangaShelf, type StoredManga } from "@/lib/manga"
import { clip, useHead } from "@/lib/seo"
import { cn } from "@/lib/utils"

const dateFmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" })

export default function MangaDetail() {
  const { id } = useParams()
  const { data: m, isLoading, error } = useMangaSeries(id)
  const progress = useMangaProgress().find((p) => p.series.id === id)
  const [filter, setFilter] = useState("")
  const [oldestFirst, setOldestFirst] = useState(false)
  const [more, setMore] = useState(false)

  useHead({
    title: m ? `Read ${m.title} Manga Online Free | MangaGang` : undefined,
    description: m
      ? clip(`Read ${m.title} online free in English${m.chapters.length ? ` — all ${m.chapters.length} chapters` : ""}${m.chapters[0] ? `, latest ${m.chapters[0].name}` : ""}. ${m.description}`)
      : undefined,
    path: m ? mangaHref(m) : undefined,
    image: m?.cover_large,
  })

  const chapters = useMemo(() => {
    const list = m?.chapters ?? []
    const f = filter.trim().toLowerCase()
    const filtered = f ? list.filter((c) => c.name.toLowerCase().includes(f)) : list
    return oldestFirst ? [...filtered].reverse() : filtered
  }, [m, filter, oldestFirst])

  if (error) return <Container className="pt-32 text-center text-white/60">This manga couldn't be loaded. It may have been removed, or the source is down right now.</Container>
  if (isLoading || !m) return <DetailSkeleton />

  const first = m.chapters.at(-1)
  const latest = m.chapters[0]

  return (
    <>
      <section className="relative overflow-hidden pt-24 pb-10 sm:pt-28">
        <img src={m.cover_large} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-20 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/75 to-background" />
        <Container className="relative flex flex-col gap-8 md:flex-row">
          <img src={m.cover_large} alt={m.title} width={400} height={600} className="mx-auto aspect-[2/3] w-48 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 md:mx-0 md:w-60" />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{m.title}</h1>
            {m.authors.length > 0 && <p className="mt-2 text-sm text-white/60">by {m.authors.join(", ")}</p>}

            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px] font-medium md:justify-start">
              {m.type && <span className="rounded-md bg-primary px-2 py-0.5 text-primary-foreground">{m.type}</span>}
              {m.status && <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/85">{m.status}</span>}
              {m.year && <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/85">{m.year}</span>}
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/85">{m.chapters.length} chapters</span>
              {m.official && (
                <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white/85">
                  <BadgeCheck className="size-3.5 text-primary" /> Official translation
                </span>
              )}
              {m.anime && (
                <Link to={`/search?q=${encodeURIComponent(m.title)}`} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white/85 hover:bg-white/15">
                  <Tv className="size-3.5" /> Has an anime
                </Link>
              )}
            </div>

            {m.description && (
              <div className="mx-auto mt-5 max-w-3xl md:mx-0">
                <p className={cn("text-[15px] leading-relaxed whitespace-pre-line text-white/70", !more && "line-clamp-4")}>{m.description}</p>
                {m.description.length > 280 && (
                  <button onClick={() => setMore(!more)} className="mt-1.5 text-sm font-medium text-primary hover:underline">
                    {more ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}

            {m.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-1.5 md:justify-start">
                {m.tags.map((t) => (
                  <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">{t}</span>
                ))}
              </div>
            )}

            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              {progress ? (
                <Link to={readHref(m.id, progress.chapterId)} className="flex h-12 items-center gap-2 rounded-[14px] bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition hover:brightness-110">
                  <BookOpen className="size-4" /> Continue {progress.chapterName}
                </Link>
              ) : (
                first && (
                  <Link to={readHref(m.id, first.id)} className="flex h-12 items-center gap-2 rounded-[14px] bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition hover:brightness-110">
                    <BookOpen className="size-4" /> Start reading
                  </Link>
                )
              )}
              {latest && latest !== first && (
                <Link to={readHref(m.id, latest.id)} className="flex h-12 items-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.06] px-6 text-[15px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.12]">
                  Latest: {latest.name}
                </Link>
              )}
              <ShelfButton list="saved" series={m} icon={Bookmark} label="Save" activeLabel="Saved" />
              <ShelfButton list="plan" series={m} icon={ListPlus} label="Add to reading list" activeLabel="In reading list" />
            </div>
          </div>
        </Container>
      </section>

      <Container className="mt-4">
        <LeaderboardAd className="mb-10" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-white">Chapters</h2>
          <div className="flex items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 focus-within:border-primary/60">
              <Search className="size-3.5 text-white/45" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find chapter…" aria-label="Find chapter" className="w-28 bg-transparent text-sm text-white outline-none placeholder:text-white/35 sm:w-40" />
            </label>
            <button onClick={() => setOldestFirst(!oldestFirst)} className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm text-white/70 hover:border-white/25 hover:text-white">
              <ArrowDownUp className="size-3.5" />
              {oldestFirst ? "Oldest" : "Newest"}
            </button>
          </div>
        </div>

        {m.chapters.length === 0 ? (
          <p className="mt-6 text-white/55">No chapters are available for this series yet.</p>
        ) : (
          <ChapterList seriesId={m.id} chapters={chapters} currentId={progress?.chapterId} />
        )}
      </Container>
    </>
  )
}

function ShelfButton({ list, series, icon: Icon, label, activeLabel }: { list: MangaShelf; series: StoredManga; icon: React.ComponentType<{ className?: string }>; label: string; activeLabel: string }) {
  const on = useMangaShelves().some((e) => e.list === list && e.series.id === series.id)
  return (
    <button
      onClick={() => toggleShelf(list, series)}
      aria-pressed={on}
      className={cn(
        "flex h-12 items-center gap-2 rounded-[14px] border px-5 text-[15px] font-semibold transition",
        on ? "border-primary/60 bg-primary/15 text-white [&_svg]:fill-primary [&_svg]:text-primary" : "border-white/15 bg-white/[0.06] text-white hover:border-white/30 hover:bg-white/[0.12]",
      )}
    >
      <Icon className="size-4" />
      {on ? activeLabel : label}
    </button>
  )
}

// Long series have 1,000+ chapters: render in steps instead of all at once.
function ChapterList({ seriesId, chapters, currentId }: { seriesId: string; chapters: { id: string; name: string; date: string | null }[]; currentId?: string }) {
  const [shown, setShown] = useState(120)
  return (
    <>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.slice(0, shown).map((c) => (
          <li key={c.id}>
            <Link
              to={readHref(seriesId, c.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm transition hover:border-primary/40 hover:bg-white/[0.05]",
                c.id === currentId && "border-primary/50 bg-primary/10",
              )}
            >
              <span className="truncate font-medium text-white/90">{c.name}</span>
              {c.date && <span className="shrink-0 text-xs text-white/40">{dateFmt.format(new Date(c.date))}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {chapters.length > shown && (
        <button onClick={() => setShown(shown + 240)} className="mx-auto mt-5 block rounded-xl border border-white/10 px-5 py-2 text-sm font-medium text-white/75 hover:border-primary/50 hover:text-white">
          Show more ({chapters.length - shown} left)
        </button>
      )}
    </>
  )
}

function DetailSkeleton() {
  return (
    <Container className="flex flex-col gap-8 pt-28 md:flex-row">
      <div className="mx-auto aspect-[2/3] w-48 animate-pulse rounded-2xl bg-white/[0.05] md:mx-0 md:w-60" />
      <div className="flex-1 space-y-4">
        <div className="h-9 w-2/3 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-24 w-full animate-pulse rounded bg-white/[0.04]" />
      </div>
    </Container>
  )
}
