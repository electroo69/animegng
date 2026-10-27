import { useEffect, useState } from "react"
import { animeHref } from "@/lib/seo"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Loader2, Search, Star } from "lucide-react"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useList, useSearch } from "@/lib/api"
import { formatLabel, score, titleOf } from "@/lib/format"

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("")
  const dq = useDebounced(q.trim())
  const navigate = useNavigate()
  const { data, isFetching } = useSearch({ q: dq, limit: 8 }, dq.length > 1)
  const trending = useList("trending", 1, 6, open)
  const items = dq.length > 1 ? data?.results ?? [] : trending.data?.results ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const go = (path: string) => {
    onOpenChange(false)
    setQ("")
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search anime" description="Search the catalog" className="sm:max-w-xl border border-white/10 bg-popover/95 backdrop-blur-xl">
      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput placeholder="Search anime…" value={q} onValueChange={setQ} className="h-10" />
        <CommandList className="max-h-[60vh]">
          {dq.length > 1 && !isFetching && <CommandEmpty>No anime found for “{dq}”.</CommandEmpty>}
          <CommandGroup heading={dq.length > 1 ? "Results" : "Trending now"}>
            {items.map((a) => (
              <CommandItem key={a.id} value={String(a.id)} onSelect={() => go(animeHref(a))} className="gap-3 py-2">
                <img src={a.cover_image.medium} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{titleOf(a.title)}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {a.format && <span>{formatLabel(a.format)}</span>}
                    {a.season_year && <span>· {a.season_year}</span>}
                    {a.episodes && <span>· {a.episodes} eps</span>}
                    {score(a.average_score) && (
                      <span className="flex items-center gap-0.5 text-amber-300">
                        <Star className="size-3! fill-current" />
                        {score(a.average_score)}
                      </span>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          {dq.length > 1 && (
            <CommandGroup>
              <CommandItem value="__all" onSelect={() => go(`/search?q=${encodeURIComponent(dq)}`)} className="text-primary">
                {isFetching ? <Loader2 className="animate-spin" /> : <Search />}
                View all results for “{dq}”
                <ArrowRight className="ml-auto" />
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
