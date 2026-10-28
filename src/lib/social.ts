// Client for the account & community API (/api/u, served by the Worker: worker/social).
import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AnimeCard, Title } from "./api"
import { localHistory, mergeHistory, setHistorySync, type HistoryEntry } from "./progress"

export interface User {
  id: string
  username: string
  display_name: string
  avatar: string | null
  is_admin: boolean
  email?: string | null
  email_notify?: boolean
  has_password?: boolean
}

export class SocialError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function sapi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/u${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new SocialError(res.status, data.error || "Something went wrong")
  return data as T
}

// Minimal anime card stored with history/playlists/subscriptions.
export type StoredAnime = Pick<AnimeCard, "id" | "title" | "cover_image" | "banner_image" | "format" | "episodes"> &
  Partial<Pick<AnimeCard, "season_year" | "genres" | "average_score" | "next_airing_episode" | "status">>
export const storedAnime = (a: StoredAnime): StoredAnime => ({
  id: a.id,
  title: a.title,
  cover_image: a.cover_image,
  banner_image: a.banner_image ?? null,
  format: a.format ?? null,
  episodes: a.episodes ?? null,
  season_year: a.season_year ?? null,
  genres: a.genres?.slice(0, 5) ?? [],
  average_score: a.average_score ?? null,
  next_airing_episode: a.next_airing_episode ?? null,
  status: a.status ?? null,
})

// ------------------------------------------------------------------ session

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => sapi<{ user: User | null }>("/me").then((d) => d.user), staleTime: 5 * 60_000, retry: false })

export const useProviders = () =>
  useQuery({ queryKey: ["providers"], queryFn: () => sapi<{ google: boolean; discord: boolean; email: boolean }>("/auth/providers"), staleTime: Infinity })

export function useAuthActions() {
  const qc = useQueryClient()
  const done = (d: { user: User }) => {
    qc.setQueryData(["me"], d.user)
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "u" })
  }
  return {
    login: useMutation({ mutationFn: (v: { username: string; password: string }) => sapi<{ user: User }>("/auth/login", { body: v }), onSuccess: done }),
    register: useMutation({ mutationFn: (v: { username: string; password: string }) => sapi<{ user: User }>("/auth/register", { body: v }), onSuccess: done }),
    logout: useMutation({
      mutationFn: () => sapi("/auth/logout", { method: "POST" }),
      onSuccess: () => {
        qc.setQueryData(["me"], null)
        qc.removeQueries({ predicate: (q) => q.queryKey[0] === "u" })
      },
    }),
  }
}

// Keeps "continue watching" mirrored to the account while signed in.
interface ServerHistory {
  anime_id: number
  episode: number
  episode_title: string | null
  thumbnail: string | null
  anime: StoredAnime
  position: number
  duration: number
  updated_at: number
}
const toLocal = (h: ServerHistory): HistoryEntry => ({ anime: h.anime, episode: h.episode, episodeTitle: h.episode_title, thumbnail: h.thumbnail, updatedAt: h.updated_at })
const toServer = (e: HistoryEntry) => ({ anime: storedAnime(e.anime as StoredAnime), episode: e.episode, episode_title: e.episodeTitle, thumbnail: e.thumbnail, updated_at: e.updatedAt })

export function useHistorySync() {
  const { data: user } = useMe()
  useEffect(() => {
    if (!user) {
      setHistorySync(null)
      return
    }
    let cancelled = false
    // First sign-in on this device: upload local history, then take the merged result.
    sapi<{ items: ServerHistory[] }>("/history/import", { body: { items: localHistory().map(toServer) } })
      .then((d) => !cancelled && mergeHistory(d.items.map(toLocal)))
      .catch(() => {})
    setHistorySync({
      put: (e) => void sapi("/history", { method: "PUT", body: toServer(e) }).catch(() => {}),
      remove: (id) => void sapi(`/history/${id}`, { method: "DELETE" }).catch(() => {}),
    })
    return () => {
      cancelled = true
      setHistorySync(null)
    }
  }, [user])
}

// ------------------------------------------------------------------ library

export interface Playlist {
  id: string
  name: string
  items: { anime_id: number; anime: StoredAnime; added_at: number }[]
}

export const usePlaylists = (enabled = true) =>
  useQuery({ queryKey: ["u", "playlists"], queryFn: () => sapi<{ items: Playlist[] }>("/playlists").then((d) => d.items), enabled })
export const useSubscriptions = (enabled = true) =>
  useQuery({ queryKey: ["u", "subs"], queryFn: () => sapi<{ items: { anime_id: number; anime: StoredAnime }[] }>("/subscriptions").then((d) => d.items), enabled })
export const useAnimeState = (id: number, enabled: boolean) =>
  useQuery({ queryKey: ["u", "anime-state", id], queryFn: () => sapi<{ subscribed: boolean; playlists: string[] }>(`/anime/${id}/state`), enabled })

export function useLibraryActions() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "u" })
  return {
    createPlaylist: useMutation({ mutationFn: (name: string) => sapi<Playlist>("/playlists", { body: { name } }), onSuccess: refresh }),
    renamePlaylist: useMutation({ mutationFn: (v: { id: string; name: string }) => sapi(`/playlists/${v.id}`, { method: "PATCH", body: { name: v.name } }), onSuccess: refresh }),
    deletePlaylist: useMutation({ mutationFn: (id: string) => sapi(`/playlists/${id}`, { method: "DELETE" }), onSuccess: refresh }),
    addToPlaylist: useMutation({ mutationFn: (v: { id: string; anime: StoredAnime }) => sapi(`/playlists/${v.id}/items`, { body: { anime: storedAnime(v.anime) } }), onSuccess: refresh }),
    removeFromPlaylist: useMutation({ mutationFn: (v: { id: string; animeId: number }) => sapi(`/playlists/${v.id}/items/${v.animeId}`, { method: "DELETE" }), onSuccess: refresh }),
    subscribe: useMutation({ mutationFn: (anime: StoredAnime) => sapi(`/subscriptions/${anime.id}`, { method: "PUT", body: { anime: storedAnime(anime) } }), onSuccess: refresh }),
    unsubscribe: useMutation({ mutationFn: (id: number) => sapi(`/subscriptions/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  }
}

// ------------------------------------------------------------------ notifications

export interface Notification {
  id: string
  type: "episode" | "reply"
  read: boolean
  created_at: number
  payload: { anime_id: number; episode: number; title?: Title; cover?: string; from?: string; excerpt?: string; comment_id?: string }
}
export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: ["u", "notifications"],
    queryFn: () => sapi<{ unread: number; items: Notification[] }>("/notifications"),
    enabled,
    refetchInterval: 120_000,
  })

// ------------------------------------------------------------------ votes & comments

export interface Comment {
  id: string
  anime_id: number
  episode: number
  parent_id: string | null
  body: string | null
  deleted: boolean
  spoiler: boolean
  ts: number | null
  likes: number
  dislikes: number
  reply_count: number
  created_at: number
  my_vote: number
  user: { id: string; username: string; display_name: string; avatar: string | null; is_admin: boolean }
}
export interface LiveComment {
  id: string
  ts: number
  body: string
  spoiler: boolean
  display_name: string
  username: string
}

export const useEpisodeVotes = (anime: number, ep: number) =>
  useQuery({ queryKey: ["u", "ep-votes", anime, ep], queryFn: () => sapi<{ likes: number; dislikes: number; my_vote: number }>(`/episodes/${anime}/${ep}`) })

export const useLiveComments = (anime: number, ep: number, enabled: boolean) =>
  useQuery({ queryKey: ["u", "live", anime, ep], queryFn: () => sapi<{ items: LiveComment[] }>(`/live?anime=${anime}&ep=${ep}`).then((d) => d.items), enabled, staleTime: 60_000 })

export const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?"
