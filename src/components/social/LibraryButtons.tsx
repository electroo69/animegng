// Subscribe (new-episode notifications) and Save-to-playlist buttons for an anime.
import { useState } from "react"
import { Bell, BellRing, Bookmark, BookmarkCheck, Check, Plus } from "lucide-react"
import { useRequireAuth } from "@/components/social/AuthDialog"
import { Dropdown } from "@/components/social/ui"
import { useAnimeState, useLibraryActions, useMe, usePlaylists, type StoredAnime } from "@/lib/social"
import { cn } from "@/lib/utils"

const btn = "flex h-12 items-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.06] px-5 font-semibold backdrop-blur-md transition hover:bg-white/[0.12]"

export function SubscribeButton({ anime }: { anime: StoredAnime }) {
  const { data: user } = useMe()
  const state = useAnimeState(anime.id, !!user)
  const { subscribe, unsubscribe } = useLibraryActions()
  const requireAuth = useRequireAuth()
  const on = !!state.data?.subscribed
  return (
    <button
      onClick={() => requireAuth(() => (on ? unsubscribe.mutate(anime.id) : subscribe.mutate(anime)), "Sign in to get notified when new episodes come out.")}
      disabled={subscribe.isPending || unsubscribe.isPending}
      className={cn(btn, on && "border-primary/50 bg-primary/15 text-white")}
      title={on ? "You'll be notified about new episodes" : "Get notified about new episodes"}
    >
      {on ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
      {on ? "Subscribed" : "Subscribe"}
    </button>
  )
}

export function SaveButton({ anime }: { anime: StoredAnime }) {
  const { data: user } = useMe()
  const requireAuth = useRequireAuth()
  const state = useAnimeState(anime.id, !!user)
  const lists = usePlaylists(!!user)
  const { createPlaylist, addToPlaylist, removeFromPlaylist } = useLibraryActions()
  const [name, setName] = useState("")
  const saved = new Set(state.data?.playlists ?? [])

  if (!user)
    return (
      <button onClick={() => requireAuth(() => {}, "Sign in to save anime to your playlists.")} className={btn}>
        <Bookmark className="size-4" />
        Save
      </button>
    )

  return (
    <Dropdown
      align="left"
      className="w-64 p-2"
      trigger={() => (
        <button className={cn(btn, saved.size > 0 && "border-brand-blue/50 bg-brand-blue/15")}>
          {saved.size ? <BookmarkCheck className="size-4 text-[#8ea2ff]" /> : <Bookmark className="size-4" />}
          {saved.size ? "Saved" : "Save"}
        </button>
      )}
    >
      {() => (
        <>
          <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-widest text-white/40 uppercase">Save to playlist</p>
          {lists.data?.map((l) => {
            const on = saved.has(l.id)
            return (
              <button
                key={l.id}
                onClick={() => (on ? removeFromPlaylist.mutate({ id: l.id, animeId: anime.id }) : addToPlaylist.mutate({ id: l.id, anime }))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5"
              >
                <span className={cn("grid size-4 place-items-center rounded border", on ? "border-primary bg-primary" : "border-white/30")}>{on && <Check className="size-3" />}</span>
                <span className="flex-1 truncate">{l.name}</span>
                <span className="text-xs text-white/35">{l.items.length}</span>
              </button>
            )
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              createPlaylist.mutate(name.trim(), { onSuccess: (p) => addToPlaylist.mutate({ id: p.id, anime }) })
              setName("")
            }}
            className="mt-1 flex gap-1.5 border-t border-white/10 pt-2"
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist" maxLength={60} className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-sm outline-none focus:border-primary/60" />
            <button aria-label="Create playlist" className="grid size-8 place-items-center rounded-lg bg-primary text-white">
              <Plus className="size-4" />
            </button>
          </form>
        </>
      )}
    </Dropdown>
  )
}
