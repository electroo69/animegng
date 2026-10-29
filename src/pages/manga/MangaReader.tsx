import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { LeaderboardAd } from "@/components/AdSlot"
import { api } from "@/lib/api"
import { mangaHref, readHref, saveMangaProgress, useMangaChapter, useMangaSeries } from "@/lib/manga"
import { useHead } from "@/lib/seo"

// Long-strip reader: every page stacked vertically, lazy-loaded after the first few.
export default function MangaReader() {
  const { sid, cid } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: series } = useMangaSeries(sid)
  const { data, isLoading, error } = useMangaChapter(cid)

  // Chapters are newest first: "next" in reading order is the one before this in the list.
  const index = series?.chapters.findIndex((c) => c.id === cid) ?? -1
  const current = index >= 0 ? series!.chapters[index] : undefined
  const prev = index >= 0 ? series!.chapters[index + 1] : undefined
  const next = index > 0 ? series!.chapters[index - 1] : undefined

  useHead({
    title: series && current ? `${series.title} ${current.name} | MangaGang` : "Reading | MangaGang",
    description: series ? `Read ${series.title} ${current?.name ?? ""} online free on MangaGang.` : undefined,
    path: sid && cid ? readHref(sid, cid) : undefined,
    noindex: true,
  })

  useEffect(() => {
    if (series && current) saveMangaProgress({ series: { id: series.id, title: series.title, cover: series.cover }, chapterId: current.id, chapterName: current.name })
  }, [series, current])

  // Warm the next chapter so turning the page is instant.
  useEffect(() => {
    if (next) qc.prefetchQuery({ queryKey: ["manga", "chapter", next.id], queryFn: () => api(`/manga/chapter/${next.id}`), staleTime: 60 * 60_000 })
  }, [next, qc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return
      if (e.key === "ArrowRight" && next) navigate(readHref(sid!, next.id))
      if (e.key === "ArrowLeft" && prev) navigate(readHref(sid!, prev.id))
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [next, prev, sid, navigate])

  const nav = (
    <div className="flex items-center gap-2">
      <ChapterButton to={prev && readHref(sid!, prev.id)} label="Previous chapter">
        <ChevronLeft className="size-4" /> Prev
      </ChapterButton>
      {series && (
        <select
          value={cid}
          onChange={(e) => navigate(readHref(sid!, e.target.value))}
          aria-label="Choose chapter"
          className="h-9 max-w-[42vw] rounded-lg border border-white/10 bg-background px-2 text-sm text-white outline-none focus:border-primary/60 sm:max-w-60"
        >
          {series.chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <ChapterButton to={next && readHref(sid!, next.id)} label="Next chapter">
        Next <ChevronRight className="size-4" />
      </ChapterButton>
    </div>
  )

  return (
    <div className="pt-16">
      <div className="sticky top-16 z-40 border-b border-white/[0.06] bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-3">
          <Link to={series ? mangaHref(series) : "/manga"} className="flex min-w-0 items-center gap-2 text-sm font-medium text-white/80 hover:text-white">
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{series?.title ?? "Back"}</span>
          </Link>
          {nav}
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        {isLoading && (
          <div className="grid h-[70vh] place-items-center text-white/60">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="px-4 py-24 text-center text-white/60">This chapter couldn't be loaded. Try again, or pick another chapter.</p>}
        {data?.pages.map((src, n) => (
          <img
            key={src}
            src={src}
            alt={`Page ${n + 1}`}
            loading={n < 3 ? "eager" : "lazy"}
            decoding="async"
            className="mx-auto block h-auto w-full bg-white/[0.02]"
            style={{ minHeight: "40vh" }}
            onLoad={(e) => (e.currentTarget.style.minHeight = "")}
          />
        ))}
      </div>

      {data && (
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-12 text-center">
          <LeaderboardAd className="mb-4" />
          <p className="text-sm text-white/55">{next ? `Up next: ${next.name}` : "You're all caught up on this series."}</p>
          {nav}
        </div>
      )}
    </div>
  )
}

function ChapterButton({ to, label, children }: { to?: string; label: string; children: React.ReactNode }) {
  const cls = "flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium"
  if (!to) return <span className={`${cls} text-white/25`} aria-disabled>{children}</span>
  return (
    <Link to={to} aria-label={label} className={`${cls} bg-primary text-primary-foreground transition hover:brightness-110`}>
      {children}
    </Link>
  )
}
