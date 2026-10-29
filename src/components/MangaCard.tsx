import { Link } from "react-router-dom"
import { BadgeCheck } from "lucide-react"
import { mangaHref, type MangaCard as Card } from "@/lib/manga"
import { cn } from "@/lib/utils"

export function MangaCard({ manga, rank, className }: { manga: Card; rank?: number; className?: string }) {
  return (
    <Link to={mangaHref(manga)} className={cn("group/card block outline-none", className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] transition duration-500 group-hover/card:-translate-y-1 group-focus-visible/card:ring-2 group-focus-visible/card:ring-primary">
        <img src={manga.cover} alt={manga.title} loading="lazy" decoding="async" className="size-full object-cover transition duration-700 ease-out group-hover/card:scale-[1.07]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/0" />
        {rank !== undefined && (
          <span className="absolute -top-1 left-2 font-mono text-5xl font-black italic text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1 text-[10.5px] font-semibold">
          {manga.type && <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">{manga.type}</span>}
          {manga.status && <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-white backdrop-blur-md">{manga.status}</span>}
          {manga.official && (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-white backdrop-blur-md" title="Official translation">
              <BadgeCheck className="size-3 text-primary" />
              Official
            </span>
          )}
        </div>
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[13.5px] leading-snug font-medium text-white/90 transition group-hover/card:text-white">{manga.title}</h3>
      <p className="mt-0.5 truncate text-xs text-white/45">{[manga.year, manga.tags.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</p>
    </Link>
  )
}

export function MangaCardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.05]" />
      <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-white/[0.05]" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
    </div>
  )
}
