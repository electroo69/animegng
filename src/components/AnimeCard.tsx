import { useState } from "react"
import { animeHref } from "@/lib/seo"
import { WatchLink } from "@/components/WatchLink"
import { Link } from "react-router-dom"
import { Captions, Clock, Play, Star } from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import type { AiredItem, AnimeCard as Card } from "@/lib/api"
import { availableEpisodes, countdown, formatLabel, score, timeAgo, titleOf } from "@/lib/format"
import { cn } from "@/lib/utils"

const BEAM = { colorFrom: "#ff1f2d", colorTo: "#2b4bff" }

export function AnimeCard({ anime, rank, className }: { anime: Card; rank?: number; className?: string }) {
  const [hover, setHover] = useState(false)
  const s = score(anime.average_score)
  const eps = availableEpisodes(anime)
  return (
    <Link
      to={animeHref(anime)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("group/card block outline-none", className)}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] transition duration-500 group-hover/card:-translate-y-1 group-focus-visible/card:ring-2 group-focus-visible/card:ring-primary">
        <img
          src={anime.cover_image.large || anime.cover_image.extra_large}
          decoding="async"
          alt={titleOf(anime.title)}
          loading="lazy"
          className="size-full object-cover transition duration-700 ease-out group-hover/card:scale-[1.07]"
          style={{ backgroundColor: anime.cover_image.color ?? undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/0" />
        <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover/card:opacity-100">
          <span className="grid size-12 scale-75 place-items-center rounded-full bg-primary/90 backdrop-blur transition duration-300 group-hover/card:scale-100">
            <Play className="ml-0.5 size-5 fill-white text-white" />
          </span>
        </div>

        {rank !== undefined && (
          <span className="absolute -top-1 left-2 font-mono text-5xl font-black italic text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        {s && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            <Star className="size-3 fill-amber-300 text-amber-300" />
            {s}
          </span>
        )}
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1 text-[10.5px] font-semibold">
          {eps > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-white">
              <Captions className="size-3" />
              {eps}
            </span>
          )}
          {anime.format && <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-white backdrop-blur-md">{formatLabel(anime.format)}</span>}
          {anime.next_airing_episode && (
            <span className="flex items-center gap-1 rounded-md bg-brand-blue/80 px-1.5 py-0.5 text-white backdrop-blur-md">
              <Clock className="size-3" />
              EP {anime.next_airing_episode.episode} · {countdown(anime.next_airing_episode.time_until_airing)}
            </span>
          )}
        </div>
        {hover && <BorderBeam size={90} duration={5} {...BEAM} borderWidth={1.5} />}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[13.5px] leading-snug font-medium text-white/90 transition group-hover/card:text-white">{titleOf(anime.title)}</h3>
      <p className="mt-0.5 truncate text-xs text-white/45">
        {[anime.season_year, anime.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
      </p>
    </Link>
  )
}

export function EpisodeCard({ item }: { item: AiredItem }) {
  const a = item.anime
  return (
    <WatchLink to={`/watch/${a.id}/${item.episode}`} className="group/ep block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] transition duration-500 group-hover/ep:shadow-[0_20px_50px_-20px_rgba(43,75,255,0.6)]">
        <img
          src={a.banner_image ?? a.cover_image.large}
          decoding="async"
          alt=""
          loading="lazy"
          className="size-full object-cover transition duration-700 group-hover/ep:scale-105"
          style={{ backgroundColor: a.cover_image.color ?? undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <img src={a.cover_image.large} alt="" loading="lazy" className="absolute bottom-3 left-3 h-[58%] rounded-md shadow-xl ring-1 ring-white/10" />
        <div className="absolute right-3 bottom-3 left-[calc(3rem+14%)] pl-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-white">EP {item.episode}</span>
          <h3 className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold text-white">{titleOf(a.title)}</h3>
          <p className="mt-0.5 text-[11px] text-white/55">{timeAgo(item.aired_at)}</p>
        </div>
        <div className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/10 opacity-0 backdrop-blur-md transition group-hover/ep:opacity-100">
          <Play className="ml-0.5 size-4 fill-white text-white" />
        </div>
      </div>
    </WatchLink>
  )
}

export function CardSkeleton({ landscape }: { landscape?: boolean }) {
  return (
    <div>
      <div className={cn("animate-pulse rounded-xl bg-white/[0.05]", landscape ? "aspect-video" : "aspect-[2/3]")} />
      {!landscape && (
        <>
          <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-white/[0.05]" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
        </>
      )}
    </div>
  )
}
