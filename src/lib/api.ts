// Typed client for the local "api without reanime" server (proxied at /api by Vite).
import { useQuery, keepPreviousData } from "@tanstack/react-query"

export interface Title {
  english: string | null
  romaji: string | null
  native: string | null
  user_preferred: string | null
}

export interface NextAiring {
  episode: number
  airing_at: string
  time_until_airing: number
}

export interface AnimeCard {
  id: number
  mal_id: number | null
  title: Title
  cover_image: { color: string | null; extra_large: string; large: string; medium: string }
  banner_image: string | null
  format: string | null
  status: string | null
  genres: string[]
  season: string | null
  season_year: number | null
  episodes: number | null
  duration: number | null
  average_score: number | null
  popularity: number | null
  country: string | null
  is_adult: boolean
  next_airing_episode: NextAiring | null
}

export interface Character {
  id: number
  name: string
  native_name: string | null
  image: string
  role: string
  voice_actors: { id: number; name: string; native_name: string | null; image: string; language: string }[]
}

export interface Relation extends AnimeCard {
  relation_type: string
  type: string
}

export interface AnimeDetail extends AnimeCard {
  description: string | null
  synonyms: string[]
  source: string | null
  hashtag: string | null
  mean_score: number | null
  favourites: number | null
  trending: number | null
  start_date: string | null
  end_date: string | null
  trailer: { id: string; site: string; thumbnail: string; url: string } | null
  tags: { id: number; name: string; rank: number; description: string; isMediaSpoiler: boolean }[]
  studios: { id: number; name: string; is_main: boolean }[]
  external_links: { site: string; url: string; type?: string; icon?: string | null; color?: string | null }[]
  rankings: { id: number; rank: number; type: string; allTime: boolean; context: string; year: number | null; season: string | null }[]
  relations: Relation[]
  ids: Record<string, string | number | null> | null
  artwork: { coverType: string; url: string }[] | null
  characters: Character[]
  staff: { id: number; name: string; image: string; role: string }[]
  recommendations: AnimeCard[]
}

export interface Episode {
  episode_number: number
  title: string | null
  title_japanese: string | null
  title_romaji: string | null
  description: string | null
  aired: string | null
  duration: number | null
  thumbnail: string | null
  rating: number | null
  is_filler: boolean | null
  is_recap: boolean | null
}

export interface EpisodeList {
  anime_id: number
  total: number
  total_planned: number | null
  next_airing_episode: NextAiring | null
  data: Episode[]
}

export interface Server {
  id: string
  name: string
  embed_url: string
  softsub: boolean
}

export interface WatchData {
  server_error?: string
  anime: AnimeCard
  episode: Episode | null
  prev_episode: number | null
  next_episode: number | null
  available: boolean
  servers: { sub: Server[]; dub: Server[] }
}

export interface AiredItem {
  episode: number
  aired_at: string
  anime: AnimeCard
}

export interface HomeData {
  season: { season: string; year: number }
  trending: AnimeCard[]
  seasonal: AnimeCard[]
  upcoming: AnimeCard[]
  top_rated: AnimeCard[]
  latest_aired: AiredItem[]
}

export interface Paged<T> {
  page: number
  last_page: number
  total: number
  has_more: boolean
  results: T[]
}

export interface ScheduleItem extends AiredItem {
  local_time: string
  aired: boolean
}

export interface ScheduleData {
  timezone: string
  week: number
  week_start: string
  week_end: string
  schedule: { date: string; day: string; episodes: ScheduleItem[] }[]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Dev: Vite proxies /api to the local server. Production: set VITE_API_URL at build time.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api"

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error || res.statusText)
  }
  return res.json()
}

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

const MIN = 60_000

export const useHome = () => useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("/home"), staleTime: 5 * MIN })

export const useAnime = (id: number | undefined) =>
  useQuery({ queryKey: ["anime", id], queryFn: () => api<AnimeDetail>(`/anime/${id}`), enabled: !!id, staleTime: 30 * MIN })

export const useEpisodes = (id: number | undefined) =>
  useQuery({ queryKey: ["episodes", id], queryFn: () => api<EpisodeList>(`/anime/${id}/episodes`), enabled: !!id, staleTime: 10 * MIN })

export const useWatch = (id: number | undefined, ep: number | undefined) =>
  useQuery({
    queryKey: ["watch", id, ep],
    queryFn: () => api<WatchData>(`/watch/${id}/${ep}`),
    enabled: !!id && !!ep,
    staleTime: 10 * MIN,
    placeholderData: keepPreviousData,
  })

export const useList = (kind: string, page = 1, limit = 24, enabled = true) =>
  useQuery({
    queryKey: ["list", kind, page, limit],
    queryFn: () => api<Paged<AnimeCard>>(`/list/${kind}${qs({ page, limit })}`),
    enabled,
    staleTime: 10 * MIN,
    placeholderData: keepPreviousData,
  })

export const useLatestAired = (page = 1, limit = 24) =>
  useQuery({
    queryKey: ["latest", page, limit],
    queryFn: () => api<Paged<AiredItem>>(`/latest-aired${qs({ page, limit })}`),
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  })

export type SearchParams = Record<string, string | number | undefined>

export const useSearch = (params: SearchParams, enabled = true) =>
  useQuery({
    queryKey: ["search", params],
    queryFn: () => api<Paged<AnimeCard>>(`/search${qs(params)}`),
    enabled,
    staleTime: 10 * MIN,
    placeholderData: keepPreviousData,
  })

export const useFacets = () =>
  useQuery({ queryKey: ["facets"], queryFn: () => api<{ genres: string[]; tags: { name: string; category: string }[] }>("/search/facets"), staleTime: Infinity })

export const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone

export const useSchedule = (week = 0) =>
  useQuery({
    queryKey: ["schedule", week],
    queryFn: () => api<ScheduleData>(`/schedule${qs({ tz: userTz, week })}`),
    staleTime: 10 * MIN,
    placeholderData: keepPreviousData,
  })

// Builds the player iframe URL from a server's embed_url (same params the API's /embed route adds).
export function embedSrc(server: Server, o: { dub: boolean; autoplay: boolean; skipIntro: boolean; skipOutro: boolean; startAt?: number }) {
  const u = new URL(server.embed_url)
  if (server.name === "HD-3") u.searchParams.set("autostart", String(o.autoplay))
  else {
    u.searchParams.set("autoPlay", String(o.autoplay))
    u.searchParams.set("skI", String(o.skipIntro))
    u.searchParams.set("skO", String(o.skipOutro))
    if (o.startAt) u.searchParams.set("start_at", String(Math.floor(o.startAt)))
  }
  if (o.dub) u.searchParams.set("a", "1")
  return u.toString()
}
