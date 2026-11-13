import { useMemo, useState } from "react"
import { withNativeAds } from "@/components/AdSlot"
import { WatchLink } from "@/components/WatchLink"
import { LayoutGrid, List, Play, Search, Star } from "lucide-react"
import type { Episode } from "@/lib/api"
import { cn } from "@/lib/utils"

const CHUNK = 100

// Episode browser used on the detail page: range tabs for long shows, search, grid/list views.
export function EpisodeGrid({ animeId, episodes, total, fallbackImage }: { animeId: number; episodes: Episode[]; total: number; fallbackImage?: string | null }) {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [q, setQ] = useState("")
  const ranges = Math.ceil(total / CHUNK)
  const [range, setRange] = useState(0)

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term) return episodes.filter((e) => String(e.episode_number) === term || e.title?.toLowerCase().includes(term))
    return episodes.slice(range * CHUNK, range * CHUNK + CHUNK)
  }, [episodes, q, range])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find episode…"
            className="h-9 w-48 rounded-lg border border-white/10 bg-white/[0.04] pr-3 pl-9 text-sm outline-none placeholder:text-white/35 focus:border-primary/60"
          />
        </div>
        {ranges > 1 && !q && (
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
            {Array.from({ length: ranges }, (_, n) => (
              <button
                key={n}
                onClick={() => setRange(n)}
                className={cn("h-9 shrink-0 rounded-lg border border-white/10 px-3 font-mono text-xs text-white/55 transition hover:text-white", range === n && "border-primary/60 bg-primary/15 text-white")}
              >
                {n * CHUNK + 1}–{Math.min(total, (n + 1) * CHUNK)}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex rounded-lg border border-white/10 p-0.5">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} className={cn("grid size-8 place-items-center rounded-md text-white/45", view === v && "bg-white/10 text-white")}>
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {withNativeAds(shown.map((e) => (
            <WatchLink key={e.episode_number} to={`/watch/${animeId}/${e.episode_number}`} className="group/e block">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07]">
                {(e.thumbnail || fallbackImage) && (
                  <img src={e.thumbnail ?? fallbackImage!} alt="" loading="lazy" className={cn("size-full object-cover transition duration-700 group-hover/e:scale-105", !e.thumbnail && "opacity-40 blur-[2px]")} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold backdrop-blur">EP {e.episode_number}</span>
                {e.is_filler && <span className="absolute top-2 right-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-black">FILLER</span>}
                {e.duration && <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/80">{e.duration}m</span>}
                <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover/e:opacity-100">
                  <span className="grid size-11 place-items-center rounded-full bg-primary">
                    <Play className="ml-0.5 size-4 fill-white" />
                  </span>
                </div>
              </div>
              <p className="mt-2 line-clamp-1 text-[13.5px] font-medium text-white/85 group-hover/e:text-white">{e.title || `Episode ${e.episode_number}`}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                {e.aired && new Date(e.aired).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                {e.rating ? (
                  <span className="flex items-center gap-0.5">
                    <Star className="size-3 fill-amber-300/80 text-amber-300/80" />
                    {e.rating.toFixed(1)}
                  </span>
                ) : null}
              </p>
            </WatchLink>
          )), CHUNK)}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.07]">
          {shown.map((e) => (
            <WatchLink key={e.episode_number} to={`/watch/${animeId}/${e.episode_number}`} className="group flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.03]">
              <span className="w-10 font-mono text-sm text-white/40 group-hover:text-primary">{String(e.episode_number).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title || `Episode ${e.episode_number}`}</p>
                {e.description && <p className="mt-0.5 line-clamp-1 text-xs text-white/40">{e.description}</p>}
              </div>
              {e.is_filler && <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-black">FILLER</span>}
              <span className="hidden text-xs text-white/35 sm:block">{e.aired && new Date(e.aired).toLocaleDateString()}</span>
              <Play className="size-4 text-white/30 group-hover:fill-primary group-hover:text-primary" />
            </WatchLink>
          ))}
        </div>
      )}
      {!shown.length && <p className="py-10 text-center text-sm text-white/40">No episodes match.</p>}
    </div>
  )
}
