// "Continue watching" history, kept in this browser only.
import { useSyncExternalStore } from "react"
import type { AnimeCard } from "./api"

export interface HistoryEntry {
  anime: Pick<AnimeCard, "id" | "title" | "cover_image" | "banner_image" | "format" | "episodes">
  episode: number
  episodeTitle: string | null
  thumbnail: string | null
  updatedAt: number
}

const KEY = "ag:history"
const listeners = new Set<() => void>()
let snapshot: HistoryEntry[] = read()

function read(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]")
  } catch {
    return []
  }
}

function write(list: HistoryEntry[]) {
  snapshot = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l())
}

export function recordWatch(entry: Omit<HistoryEntry, "updatedAt">) {
  const rest = snapshot.filter((e) => e.anime.id !== entry.anime.id)
  write([{ ...entry, updatedAt: Date.now() }, ...rest].slice(0, 30))
}

export function removeHistory(id: number) {
  write(snapshot.filter((e) => e.anime.id !== id))
}

export const useHistory = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )

export function lastEpisode(id: number) {
  return snapshot.find((e) => e.anime.id === id)?.episode
}

// Player preferences (sub/dub, autoplay, skip intro/outro).
export interface PlayerPrefs {
  lang: "sub" | "dub"
  server: string
  autoplay: boolean
  autoNext: boolean
  skipIntro: boolean
  skipOutro: boolean
  ambient: boolean
}
// v2: the default server became "Direct" (our own HLS player); older saved prefs defaulted to an embed.
const PREF_KEY = "ag:player:v2"
const defaults: PlayerPrefs = { lang: "sub", server: "Direct", autoplay: true, autoNext: true, skipIntro: false, skipOutro: false, ambient: true }

export function loadPrefs(): PlayerPrefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }
  } catch {
    return defaults
  }
}
export function savePrefs(p: PlayerPrefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// Last playback position per episode, used for the player's start_at.
const TIME_KEY = "ag:time"
let times: Record<string, [number, number]> = (() => {
  try {
    return JSON.parse(localStorage.getItem(TIME_KEY) || "{}")
  } catch {
    return {}
  }
})()

export function saveTime(id: number, ep: number, current: number, duration: number) {
  times[`${id}:${ep}`] = [Math.floor(current), Math.floor(duration)]
  const keys = Object.keys(times)
  if (keys.length > 400) times = Object.fromEntries(keys.slice(-300).map((k) => [k, times[k]]))
  try {
    localStorage.setItem(TIME_KEY, JSON.stringify(times))
  } catch {
    /* ignore */
  }
}

// Resume point in seconds, or 0 if unwatched or nearly finished.
export function resumeTime(id: number, ep: number) {
  const t = times[`${id}:${ep}`]
  if (!t) return 0
  const [cur, dur] = t
  return dur && cur > dur - 90 ? 0 : cur
}
