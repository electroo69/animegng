// MangaGang (/manga): typed client for the /api/manga routes (worker/manga.js) and local reading progress.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useSyncExternalStore } from "react"
import { api } from "@/lib/api"
import { sapi, useMe } from "@/lib/social"

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
export const mangaHref = (m: { id: string; title: string; slug?: string | null }) => `/manga/${m.id}/${m.slug || slugify(m.title)}`
export const readHref = (seriesId: string, chapterId: string) => `/manga/read/${seriesId}/${chapterId}`

// ------------------------------------------------------------------ continue reading, Saved, Reading list
// Kept in this browser; when signed in, useMangaSync mirrors every change to the account (worker/social,
// tables manga_history and manga_library) and merges the account's data back in.

export type StoredManga = Pick<MangaCard, "id" | "title" | "cover"> & { slug?: string | null }
export type MangaShelf = "saved" | "plan"
export const SHELVES: Record<MangaShelf, string> = { saved: "Saved", plan: "Reading list" }

export interface MangaProgress {
  series: StoredManga
  chapterId: string
  chapterName: string
  at: number
}

export interface ShelfEntry {
  list: MangaShelf
  series: StoredManga
  at: number
}

const stored = (m: StoredManga): StoredManga => ({ id: m.id, title: m.title, cover: m.cover, slug: m.slug ?? null })

function localStore<T>(key: string) {
  const listeners = new Set<() => void>()
  let snapshot: T[] = (() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]
    } catch {
      return []
    }
  })()
  return {
    get: () => snapshot,
    set(next: T[]) {
      snapshot = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Private mode or storage full: keep it in memory for this visit.
      }
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}

const history = localStore<MangaProgress>("ag:manga-progress")
const shelves = localStore<ShelfEntry>("ag:manga-shelves")

type Sync = {
  progress: (p: MangaProgress) => void
  removeProgress: (id: string) => void
  shelve: (e: ShelfEntry) => void
  unshelve: (list: MangaShelf, id: string) => void
}
let sync: Sync | null = null

export function saveMangaProgress(p: Omit<MangaProgress, "at">) {
  const entry = { ...p, series: stored(p.series), at: Date.now() }
  history.set([entry, ...history.get().filter((x) => x.series.id !== p.series.id)].slice(0, 60))
  sync?.progress(entry)
}

export function removeMangaProgress(seriesId: string) {
  history.set(history.get().filter((x) => x.series.id !== seriesId))
  sync?.removeProgress(seriesId)
}

export function toggleShelf(list: MangaShelf, series: StoredManga) {
  const has = shelves.get().some((e) => e.list === list && e.series.id === series.id)
  if (has) {
    shelves.set(shelves.get().filter((e) => !(e.list === list && e.series.id === series.id)))
    sync?.unshelve(list, series.id)
  } else {
    const entry = { list, series: stored(series), at: Date.now() }
    shelves.set([entry, ...shelves.get()])
    sync?.shelve(entry)
  }
}

export const useMangaProgress = () => useSyncExternalStore(history.subscribe, history.get, () => [] as MangaProgress[])
export const useMangaShelves = () => useSyncExternalStore(shelves.subscribe, shelves.get, () => [] as ShelfEntry[])

// ------------------------------------------------------------------ account sync

interface ServerProgress { series: StoredManga; chapter_id: string; chapter_name: string; updated_at: number }
interface ServerShelf { list: MangaShelf; series: StoredManga; added_at: number }

export function useMangaSync() {
  const { data: user } = useMe()
  useEffect(() => {
    if (!user) {
      sync = null
      return
    }
    let cancelled = false
    // Upload what this browser has, then take the merged account copy (newest progress wins per series).
    sapi<{ items: ServerProgress[] }>("/manga/history/import", {
      body: { items: history.get().map((p) => ({ series: p.series, chapter_id: p.chapterId, chapter_name: p.chapterName, updated_at: p.at })) },
    })
      .then((d) => {
        if (cancelled) return
        const byId = new Map(history.get().map((p) => [p.series.id, p]))
        for (const r of d.items) {
          const cur = byId.get(r.series.id)
          if (!cur || r.updated_at > cur.at) byId.set(r.series.id, { series: r.series, chapterId: r.chapter_id, chapterName: r.chapter_name, at: r.updated_at })
        }
        history.set([...byId.values()].sort((a, b) => b.at - a.at).slice(0, 60))
      })
      .catch(() => {})
    sapi<{ items: ServerShelf[] }>("/manga/library/import", { body: { items: shelves.get().map((e) => ({ list: e.list, series: e.series, added_at: e.at })) } })
      .then((d) => !cancelled && shelves.set(d.items.map((r) => ({ list: r.list, series: r.series, at: r.added_at }))))
      .catch(() => {})
    sync = {
      progress: (p) => void sapi("/manga/history", { method: "PUT", body: { series: p.series, chapter_id: p.chapterId, chapter_name: p.chapterName, updated_at: p.at } }).catch(() => {}),
      removeProgress: (id) => void sapi(`/manga/history/${id}`, { method: "DELETE" }).catch(() => {}),
      shelve: (e) => void sapi(`/manga/library/${e.list}`, { method: "PUT", body: { series: e.series, added_at: e.at } }).catch(() => {}),
      unshelve: (list, id) => void sapi(`/manga/library/${list}/${id}`, { method: "DELETE" }).catch(() => {}),
    }
    return () => {
      cancelled = true
      sync = null
    }
  }, [user])
}
