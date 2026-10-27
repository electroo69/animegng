import { useState } from "react"
import { Link } from "react-router-dom"
import { Clock, Radio, Star } from "lucide-react"
import { useList, useSchedule, type AnimeCard } from "@/lib/api"
import { availableEpisodes, formatLabel, score, titleOf } from "@/lib/format"
import { MagicCard } from "@/components/ui/magic-card"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "trending", label: "Trending" },
  { key: "popular", label: "Popular" },
  { key: "top", label: "All-time" },
] as const

const MAGIC = { gradientFrom: "#ff1f2d", gradientTo: "#2b4bff", gradientColor: "#1a1220", gradientOpacity: 0.6 }

export function TopTen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("trending")
  const { data, isLoading } = useList(tab, 1, 10)
  return (
    <MagicCard {...MAGIC} className="rounded-2xl">
      <div className="relative z-40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Top 10</h3>
          <div className="flex rounded-lg bg-white/[0.05] p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium text-white/50 transition", tab === t.key && "bg-primary text-white")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <ol className="space-y-1">
          {isLoading
            ? Array.from({ length: 10 }, (_, n) => <li key={n} className="h-[68px] animate-pulse rounded-xl bg-white/[0.03]" />)
            : data?.results.map((a, n) => <TopRow key={a.id} anime={a} rank={n + 1} />)}
        </ol>
      </div>
    </MagicCard>
  )
}

function TopRow({ anime, rank }: { anime: AnimeCard; rank: number }) {
  const top3 = rank <= 3
  return (
    <li>
      <Link to={`/anime/${anime.id}`} className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.04]">
        <span
          className={cn(
            "w-8 shrink-0 text-center font-mono text-2xl font-black italic",
            top3 ? "bg-gradient-to-b from-white to-brand-red bg-clip-text text-transparent" : "text-white/25",
          )}
        >
          {String(rank).padStart(2, "0")}
        </span>
        <img src={anime.cover_image.large} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13px] font-medium text-white/90 group-hover:text-white">{titleOf(anime.title)}</p>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
            {formatLabel(anime.format)}
            {availableEpisodes(anime) > 0 && <span>· {availableEpisodes(anime)} eps</span>}
            {score(anime.average_score) && (
              <span className="flex items-center gap-0.5 text-amber-300/90">
                <Star className="size-3 fill-current" />
                {score(anime.average_score)}
              </span>
            )}
          </p>
        </div>
      </Link>
    </li>
  )
}

export function AiringToday() {
  const { data, isLoading } = useSchedule(0)
  const today = new Date().toLocaleDateString("en-CA")
  const day = data?.schedule.find((d) => d.date === today)
  const items = day?.episodes ?? []
  return (
    <MagicCard {...MAGIC} className="rounded-2xl">
      <div className="relative z-40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Radio className="size-4 text-primary" />
            Airing Today
          </h3>
          <Link to="/schedule" className="text-xs text-white/45 hover:text-white">Full schedule</Link>
        </div>
        {isLoading && <div className="h-40 animate-pulse rounded-xl bg-white/[0.03]" />}
        {!isLoading && !items.length && <p className="py-6 text-center text-sm text-white/40">Nothing airing today.</p>}
        <ul className="no-scrollbar max-h-[420px] space-y-1 overflow-y-auto">
          {items.map((e) => (
            <li key={`${e.anime.id}-${e.episode}`}>
              <Link
                to={e.aired ? `/watch/${e.anime.id}/${e.episode}` : `/anime/${e.anime.id}`}
                className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
              >
                <span className={cn("w-12 shrink-0 font-mono text-[13px] font-semibold", e.aired ? "text-white/35" : "text-white")}>{e.local_time}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] text-white/85 group-hover:text-white">{titleOf(e.anime.title)}</p>
                  <p className="text-[11px] text-white/40">Episode {e.episode}</p>
                </div>
                {e.aired ? (
                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">OUT</span>
                ) : (
                  <Clock className="size-3.5 text-white/30" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MagicCard>
  )
}
