import { Link, useSearchParams } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { MangaCard, MangaCardSkeleton } from "@/components/MangaCard"
import { Container } from "@/components/Section"
import { useMangaSearch, type MangaSort } from "@/lib/manga"
import { useHead } from "@/lib/seo"
import { cn } from "@/lib/utils"
import { MangaSearchBox } from "./MangaHome"

const SORTS: [MangaSort, string][] = [
  ["popular", "Popular"],
  ["latest", "Latest updates"],
  ["az", "A–Z"],
]

export default function MangaBrowse() {
  const [params] = useSearchParams()
  const q = params.get("q") ?? ""
  const sort = (params.get("sort") as MangaSort | null) ?? (q ? "relevance" : "popular")
  const page = Math.max(1, Number(params.get("page")) || 1)
  const { data, isLoading, isFetching, error } = useMangaSearch(q, sort, page)
  const heading = q ? `Results for “${q}”` : SORTS.find(([s]) => s === sort)?.[1] ?? "Browse"

  useHead({ title: `${q ? `${q} — Manga Search` : `${heading} Manga`} | MangaGang`, description: "Search and browse manga, manhwa and manhua on MangaGang.", path: "/manga/browse", noindex: true })

  const href = (next: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q && { q }), sort, page: "1", ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])) })
    if (p.get("page") === "1") p.delete("page")
    return `/manga/browse?${p}`
  }

  return (
    <Container className="pt-24 sm:pt-28">
      <MangaSearchBox key={q} initial={q} className="max-w-2xl" />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h1>
        <div className="flex flex-wrap gap-1.5">
          {(q ? ([["relevance", "Best match"], ...SORTS] as [MangaSort, string][]) : SORTS).map(([s, label]) => (
            <Link
              key={s}
              to={href({ sort: s })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                s === sort ? "border-primary bg-primary text-primary-foreground" : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="mt-8 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">Manga search is temporarily unavailable. Please try again shortly.</p>}

      <div className={cn("mt-6 grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8", isFetching && !isLoading && "opacity-60")}>
        {isLoading ? Array.from({ length: 16 }, (_, n) => <MangaCardSkeleton key={n} />) : data?.results.map((m) => <MangaCard key={m.id} manga={m} />)}
      </div>

      {data && !data.results.length && <p className="mt-10 text-center text-white/55">No manga found{q && ` for “${q}”`}. Try a shorter or different title.</p>}

      {data && (page > 1 || data.has_next) && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
          <PageLink to={href({ page: page - 1 })} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="size-4" /> Prev
          </PageLink>
          <span className="text-sm text-white/55">Page {page}</span>
          <PageLink to={href({ page: page + 1 })} disabled={!data.has_next} label="Next page">
            Next <ChevronRight className="size-4" />
          </PageLink>
        </nav>
      )}
    </Container>
  )
}

function PageLink({ to, disabled, label, children }: { to: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "flex h-10 items-center gap-1 rounded-xl border border-white/10 px-4 text-sm font-medium"
  if (disabled) return <span className={cn(cls, "text-white/25")} aria-disabled>{children}</span>
  return (
    <Link to={to} aria-label={label} className={cn(cls, "text-white/80 transition hover:border-primary/60 hover:text-white")}>
      {children}
    </Link>
  )
}
