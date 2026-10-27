// Direct HLS streams from aniclover's public API, fetched by the viewer's browser.
// Their API and the stream/subtitle proxy send `Access-Control-Allow-Origin: *`, so no server of
// ours sits in between (that's what got video lookups filtered when they ran on Cloudflare).
import { useQuery } from "@tanstack/react-query"

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

export const useDirectStream = (id: number, ep: number, lang: "sub" | "dub", enabled = true) =>
  useQuery({
    queryKey: ["direct", id, ep, lang],
    queryFn: () => fetchDirect(id, ep, lang),
    enabled: enabled && !!id && !!ep,
    staleTime: 20 * 60_000, // proxied stream URLs are signed; don't hold them for long
    retry: 1,
  })
