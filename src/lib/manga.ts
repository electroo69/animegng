// MangaGang (/manga): typed client for the /api/manga routes (worker/manga.js) and local reading progress.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { api } from "@/lib/api"

export interface MangaCard {
  id: string
  slug: string
  title: string
  cover: string
  cover_large: string
  year: number | null
  status: string | null
  type: string | null
  authors: string[]
  tags: string[]
  official: boolean
}

export interface MangaChapter {
  id: string
  name: string
  number: number | null
  date: string | null
}

export interface MangaSeries extends Omit<MangaCard, "slug"> {
  description: string
  anime: boolean
  /** Newest first. */
  chapters: MangaChapter[]
}

export type MangaSort = "popular" | "latest" | "relevance" | "az"

const MIN = 60_000

export const useMangaHome = () =>
  useQuery({ queryKey: ["manga", "home"], queryFn: () => api<{ popular: MangaCard[]; latest: MangaCard[] }>("/manga/home"), staleTime: 5 * MIN })

export const useMangaSearch = (q: string, sort: MangaSort | undefined, page: number) =>
  useQuery({
    queryKey: ["manga", "search", q, sort, page],
    queryFn: () => api<{ page: number; has_next: boolean; results: MangaCard[] }>(`/manga/search?${new URLSearchParams({ q, sort: sort ?? "", page: String(page) })}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * MIN,
  })

export const useMangaSeries = (id: string | undefined) =>
  useQuery({ queryKey: ["manga", "series", id], queryFn: () => api<MangaSeries>(`/manga/series/${id}`), enabled: !!id, staleTime: 10 * MIN })

export const useMangaChapter = (id: string | undefined) =>
  useQuery({ queryKey: ["manga", "chapter", id], queryFn: () => api<{ id: string; pages: string[] }>(`/manga/chapter/${id}`), enabled: !!id, staleTime: 60 * MIN })

const slugify = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "manga"
export const mangaHref = (m: { id: string; title: string; slug?: string }) => `/manga/${m.id}/${m.slug || slugify(m.title)}`
export const readHref = (seriesId: string, chapterId: string) => `/manga/read/${seriesId}/${chapterId}`

// ------------------------------------------------------------------ reading progress (this browser only)

export interface MangaProgress {
  series: Pick<MangaCard, "id" | "title" | "cover">
  chapterId: string
  chapterName: string
  at: number
}

const KEY = "ag:manga-progress"
const listeners = new Set<() => void>()
let snapshot: MangaProgress[] | undefined

function read(): MangaProgress[] {
  if (snapshot) return snapshot
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) ?? "[]") as MangaProgress[]
  } catch {
    snapshot = []
  }
  return snapshot
}

function write(next: MangaProgress[]) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: progress just won't persist.
  }
  listeners.forEach((l) => l())
}

export function saveMangaProgress(p: Omit<MangaProgress, "at">) {
  write([{ ...p, at: Date.now() }, ...read().filter((x) => x.series.id !== p.series.id)].slice(0, 30))
}

export function removeMangaProgress(seriesId: string) {
  write(read().filter((x) => x.series.id !== seriesId))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useMangaProgress = () => useSyncExternalStore(subscribe, read, () => [] as MangaProgress[])
