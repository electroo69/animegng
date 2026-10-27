import type { AnimeCard, Title } from "./api"

export const titleOf = (t: Title | undefined | null) =>
  t ? t.english || t.user_preferred || t.romaji || t.native || "Untitled" : ""

const FORMATS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
}
export const formatLabel = (f: string | null | undefined) => (f ? FORMATS[f] ?? f : "")

const STATUS: Record<string, string> = {
  RELEASING: "Airing",
  FINISHED: "Finished",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
}
export const statusLabel = (s: string | null | undefined) => (s ? STATUS[s] ?? s : "")

export const cap = (s: string | null | undefined) =>
  s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : ""

export const score = (n: number | null | undefined) => (n ? (n / 10).toFixed(1) : null)

// AniList descriptions are light HTML; render as plain text paragraphs.
export const stripHtml = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [86400 * 365, "y"],
    [86400 * 30, "mo"],
    [86400 * 7, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ]
  for (const [s, u] of units) if (abs >= s) return diff > 0 ? `${Math.floor(abs / s)}${u} ago` : `in ${Math.floor(abs / s)}${u}`
  return diff > 0 ? "just now" : "soon"
}

export function countdown(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

// Episodes that can be watched now: aired count for airing shows, otherwise total.
export const availableEpisodes = (a: Pick<AnimeCard, "episodes" | "next_airing_episode">) =>
  a.next_airing_episode ? a.next_airing_episode.episode - 1 : a.episodes ?? 0

export const compact = (n: number | null | undefined) =>
  n == null ? "" : Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
