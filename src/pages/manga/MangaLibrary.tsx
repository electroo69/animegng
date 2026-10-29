// MangaGang library: continue reading, Saved and Reading list. Works signed out (this browser);
// signing in syncs it to the account (lib/manga.ts useMangaSync).
import { Link, useSearchParams } from "react-router-dom"
import { BookOpen, X } from "lucide-react"
import { Container } from "@/components/Section"
import { useAuthDialog } from "@/components/social/AuthDialog"
import { mangaHref, readHref, removeMangaProgress, SHELVES, toggleShelf, useMangaProgress, useMangaShelves, type MangaShelf } from "@/lib/manga"
import { useHead } from "@/lib/seo"
import { useMe } from "@/lib/social"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "reading", label: "Continue reading" },
  { key: "saved", label: SHELVES.saved },
  { key: "plan", label: SHELVES.plan },
] as const
type Tab = (typeof TABS)[number]["key"]

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8"

export default function MangaLibrary() {
  useHead({ title: "My Manga Library | MangaGang", noindex: true })
  const [sp, setSp] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.key === sp.get("tab"))?.key ?? "reading"
  const progress = useMangaProgress()
  const shelves = useMangaShelves()
  const { data: user, isLoading } = useMe()
  const { open } = useAuthDialog()
  const count = (t: Tab) => (t === "reading" ? progress.length : shelves.filter((e) => e.list === t).length)

  return (
    <Container className="pt-24">
      <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Your manga</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Library</h1>
      {!user && !isLoading && (
        <p className="mt-3 text-sm text-white/50">
          Saved in this browser only.{" "}
          <button onClick={() => open()} className="font-semibold text-primary hover:underline">Sign in</button> to sync it across your devices.
        </p>
      )}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSp(t.key === "reading" ? {} : { tab: t.key })}
            className={cn(
              "relative shrink-0 px-4 py-3 text-sm font-semibold text-white/45 transition hover:text-white",
              tab === t.key && "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-white/35">{count(t.key)}</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "reading" ? (
          progress.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {progress.map((p) => (
                <div key={p.series.id} className="group relative flex gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]">
                  <Link to={readHref(p.series.id, p.chapterId)} className="shrink-0" tabIndex={-1} aria-hidden>
                    <img src={p.series.cover} alt="" loading="lazy" className="h-28 w-[74px] rounded-lg object-cover" />
                  </Link>
                  <div className="min-w-0 py-1 pr-6">
                    <Link to={readHref(p.series.id, p.chapterId)} className="line-clamp-2 text-sm font-semibold text-white hover:underline">{p.series.title}</Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <BookOpen className="size-3.5" />
                      {p.chapterName}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">{new Date(p.at).toLocaleDateString()}</p>
                    <Link to={mangaHref(p.series)} className="mt-1 block text-[11px] text-white/45 hover:text-white">All chapters</Link>
                  </div>
                  <RemoveButton label="Remove from continue reading" onClick={() => removeMangaProgress(p.series.id)} />
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Nothing yet. Chapters you read show up here." />
          )
        ) : (
          <Shelf list={tab} />
        )}
      </div>
    </Container>
  )
}

function Shelf({ list }: { list: MangaShelf }) {
  const entries = useMangaShelves().filter((e) => e.list === list)
  if (!entries.length) return <Empty text={list === "saved" ? "Nothing saved yet. Tap Save on any manga to keep it here." : "Your reading list is empty. Add manga you want to read next."} />
  return (
    <div className={GRID}>
      {entries.map(({ series }) => (
        <div key={series.id} className="group relative">
          <Link to={mangaHref(series)} className="block">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07]">
              <img src={series.cover} alt={series.title} loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-[1.05]" />
            </div>
            <h3 className="mt-2.5 line-clamp-2 text-[13.5px] leading-snug font-medium text-white/90 group-hover:text-white">{series.title}</h3>
          </Link>
          <RemoveButton label={`Remove from ${SHELVES[list]}`} onClick={() => toggleShelf(list, series)} />
        </div>
      ))}
    </div>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white/70 backdrop-blur transition hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
    >
      <X className="size-3.5" />
    </button>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-20 text-center">
      <p className="text-white/55">{text}</p>
      <Link to="/manga/browse?sort=popular" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground">Find manga</Link>
    </div>
  )
}
