// Direct HLS streams from aniclover's public API, fetched by the viewer's browser.
// Their API and the stream/subtitle proxy send `Access-Control-Allow-Origin: *`, so no server of
// ours sits in between (that's what got video lookups filtered when they ran on Cloudflare).
import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

const ANICLOVER = "https://api.aniclover.cc/api/watch"

export interface DirectSubtitle {
  url: string
  label: string
}

export interface DirectStream {
  url: string
  subtitles: DirectSubtitle[]
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
}

interface AnicloverResponse {
  success?: boolean
  streamUrl?: string
  subtitles?: { url?: string; file?: string; label?: string; lang?: string }[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
  error?: string
  message?: string
}

async function fetchDirect(id: number, ep: number, lang: "sub" | "dub"): Promise<DirectStream | null> {
  const res = await fetch(`${ANICLOVER}/${id}/${lang}/${ep}`)
  const d: AnicloverResponse = await res.json().catch(() => ({}))
  // "No playable stream" comes back as success:false; treat it as unavailable, not an error.
  if (!d.success || !d.streamUrl) return null
  return {
    url: d.streamUrl,
    subtitles: (d.subtitles ?? [])
      .map((s) => ({ url: s.url || s.file || "", label: (s.label || s.lang || "Subtitles").replace(/\s*\(-\s*([^)]*)\)\s*/, " ($1)").trim() }))
      .filter((s) => s.url),
    intro: d.intro?.end ? d.intro : null,
    outro: d.outro?.end ? d.outro : null,
  }
}

const directQuery = (id: number, ep: number, lang: "sub" | "dub") => ({
  queryKey: ["direct", id, ep, lang],
  queryFn: () => fetchDirect(id, ep, lang),
  staleTime: 20 * 60_000, // proxied stream URLs are signed; don't hold them for long
  retry: 1,
})

export const useDirectStream = (id: number, ep: number, lang: "sub" | "dub", enabled = true) =>
  useQuery({ ...directQuery(id, ep, lang), enabled: enabled && !!id && !!ep })

// The stream lookup is ~1.3s of the time-to-first-frame, so warm it before the viewer gets there:
// on hover/focus of episode links and Next, and partway through the current episode.
// Only the lookup JSON is prefetched; playlists stay on-demand to avoid the proxy's 429s.
export function usePrefetchDirect() {
  const qc = useQueryClient()
  return useCallback(
    (id: number, ep: number, lang: "sub" | "dub" = "sub") => {
      if (id && ep) void qc.prefetchQuery(directQuery(id, ep, lang))
    },
    [qc],
  )
}
