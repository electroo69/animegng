// Signed-in library: continue watching (synced), playlists, subscriptions.
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BellOff, Pencil, Play, Trash2, X } from "lucide-react"
import { AnimeCard } from "@/components/AnimeCard"
import { Container } from "@/components/Section"
import { useAuthDialog } from "@/components/social/AuthDialog"
import { BlurFade } from "@/components/ui/blur-fade"
import type { AnimeCard as Card } from "@/lib/api"
import { titleOf } from "@/lib/format"
import { removeHistory, useHistory } from "@/lib/progress"
import { SITE_NAME, useHead } from "@/lib/seo"
import { useLibraryActions, useMe, usePlaylists, useSubscriptions, type StoredAnime } from "@/lib/social"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "history", label: "Continue watching" },
  { key: "playlists", label: "Playlists" },
  { key: "subscriptions", label: "Subscriptions" },
] as const

// Stored cards are a subset of the full card; fill the rest so AnimeCard can render them.
const asCard = (a: StoredAnime): Card => ({
  mal_id: null, popularity: null, country: null, is_adult: false, season: null, duration: null, status: null,
  season_year: null, genres: [], average_score: null, next_airing_episode: null, ...a,
  cover_image: { color: null, extra_large: a.cover_image?.extra_large ?? a.cover_image?.large ?? "", large: a.cover_image?.large ?? "", medium: a.cover_image?.medium ?? "" },
} as Card)

export default function Library() {
  useHead({ title: `My Library | ${SITE_NAME}`, noindex: true })
  const { data: user, isLoading } = useMe()
  const { open } = useAuthDialog()
  const [sp, setSp] = useSearchParams()
  const tab = (TABS.find((t) => t.key === sp.get("tab"))?.key ?? "history") as (typeof TABS)[number]["key"]

  return (
    <div className="pt-24">
      <Container>
        <BlurFade>
          <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Your stuff</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Library</h1>
        </BlurFade>
        <div className="mt-6 flex gap-1 border-b border-white/[0.07]">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setSp(t.key === "history" ? {} : { tab: t.key })} className={cn("relative px-4 py-3 text-sm font-semibold text-white/45 transition hover:text-white", tab === t.key && "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-gradient-to-r after:from-brand-red after:to-brand-blue")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          {tab === "history" && <History />}
          {tab !== "history" && !user && !isLoading && (
            <div className="py-20 text-center">
              <p className="text-white/55">Sign in to keep playlists and get new-episode notifications.</p>
              <button onClick={() => open()} className="mt-4 h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white">Sign in</button>
            </div>
          )}
          {tab === "playlists" && user && <Playlists />}
          {tab === "subscriptions" && user && <Subscriptions />}
        </div>
      </Container>
    </div>
  )
}

function History() {
  const history = useHistory()
  const { data: user } = useMe()
  if (!history.length) return <Empty text="Nothing yet. Episodes you watch show up here." />
  return (
    <>
      {!user && <p className="mb-5 text-sm text-white/45">Saved in this browser only. Sign in to sync it across devices.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {history.map((h) => (
          <div key={h.anime.id} className="group relative">
            <Link to={`/watch/${h.anime.id}/${h.episode}`} className="block">
              <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
                <img src={h.thumbnail ?? h.anime.banner_image ?? h.anime.cover_image.extra_large} alt="" className="size-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                  <span className="grid size-12 place-items-center rounded-full bg-primary"><Play className="ml-0.5 size-5 fill-white" /></span>
                </div>
                <div className="absolute right-3 bottom-3 left-3">
                  <p className="text-[11px] font-semibold text-primary">EPISODE {h.episode}</p>
                  <p className="line-clamp-1 text-sm font-semibold">{titleOf(h.anime.title)}</p>
                </div>
              </div>
            </Link>
            <button onClick={() => removeHistory(h.anime.id)} aria-label="Remove" className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function Playlists() {
  const { data, isLoading } = usePlaylists()
  const { createPlaylist, renamePlaylist, deletePlaylist, removeFromPlaylist } = useLibraryActions()
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="space-y-12">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createPlaylist.mutate(name.trim()); setName("") }} className="flex max-w-md gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" maxLength={60} className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60" />
        <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white">Create</button>
      </form>
      {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />}
      {!isLoading && !data?.length && <Empty text="No playlists yet. Use “Save” on any anime page, or create one above." />}
      {data?.map((l) => (
        <section key={l.id}>
          <div className="mb-4 flex items-center gap-3">
            {editing === l.id ? (
              <form onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("n") as string; if (v.trim()) renamePlaylist.mutate({ id: l.id, name: v.trim() }); setEditing(null) }}>
                <input name="n" defaultValue={l.name} autoFocus onBlur={() => setEditing(null)} className="h-9 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-lg font-bold outline-none" />
              </form>
            ) : (
              <h2 className="text-xl font-bold">{l.name} <span className="text-sm font-normal text-white/35">· {l.items.length}</span></h2>
            )}
            <button onClick={() => setEditing(l.id)} aria-label="Rename" className="text-white/40 hover:text-white"><Pencil className="size-4" /></button>
            <button onClick={() => confirm(`Delete "${l.name}"?`) && deletePlaylist.mutate(l.id)} aria-label="Delete playlist" className="text-white/40 hover:text-red-400"><Trash2 className="size-4" /></button>
          </div>
          {l.items.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-7">
              {l.items.map((i) => (
                <div key={i.anime_id} className="group relative">
                  <AnimeCard anime={asCard(i.anime)} />
                  <button onClick={() => removeFromPlaylist.mutate({ id: l.id, animeId: i.anime_id })} aria-label="Remove from playlist" className="absolute top-2 left-2 z-10 grid size-7 place-items-center rounded-full bg-black/70 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">Empty playlist.</p>
          )}
        </section>
      ))}
    </div>
  )
}

function Subscriptions() {
  const { data, isLoading } = useSubscriptions()
  const { unsubscribe } = useLibraryActions()
  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
  if (!data?.length) return <Empty text="Not subscribed to anything yet. Hit “Subscribe” on an airing anime to get notified when new episodes drop." />
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-7">
      {data.map((s) => (
        <div key={s.anime_id} className="group relative">
          <AnimeCard anime={asCard(s.anime)} />
          <button onClick={() => unsubscribe.mutate(s.anime_id)} title="Unsubscribe" className="absolute top-2 left-2 z-10 grid size-7 place-items-center rounded-full bg-black/70 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white">
            <BellOff className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

const Empty = ({ text }: { text: string }) => <p className="py-20 text-center text-white/45">{text}</p>
