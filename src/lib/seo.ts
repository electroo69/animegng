// Client-side SEO helpers. The edge (worker/seo.js) renders the full head for crawlers on first
// load; useHead keeps title/description/canonical/robots correct as the app navigates, which is
// what JS-rendering crawlers (Googlebot) and link previews of later routes see.
import { useEffect } from "react"
import type { Title } from "./api"
import { titleOf } from "./format"

export const SITE = "https://animegng.com"
export const SITE_NAME = "AnimeGang"

// Same algorithm as worker/seo.js slugify: keep them in sync so canonical URLs match.
export const slugify = (s: string | null | undefined) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

export const animeHref = (a: { id: number; title?: Title | null }) => {
  const slug = a.title ? slugify(titleOf(a.title)) : ""
  return slug ? `/anime/${a.id}/${slug}` : `/anime/${a.id}`
}

// Genres with their own landing page (/genre/:slug). Same list as worker/seo.js.
export const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"]

export const genreHref = (g: string) => `/genre/${slugify(g)}`

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

export function useHead({ title, description, path, image, noindex = false }: { title?: string; description?: string; path?: string; image?: string | null; noindex?: boolean }) {
  useEffect(() => {
    if (!title) return
    document.title = title
    setMeta("property", "og:title", title)
    setMeta("name", "twitter:title", title)
    if (description) {
      setMeta("name", "description", description)
      setMeta("property", "og:description", description)
      setMeta("name", "twitter:description", description)
    }
    if (image) {
      setMeta("property", "og:image", image)
      setMeta("name", "twitter:image", image)
    }
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large")
    if (path) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!link) {
        link = document.createElement("link")
        link.rel = "canonical"
        document.head.appendChild(link)
      }
      link.href = SITE + path
      setMeta("property", "og:url", SITE + path)
    }
  }, [title, description, path, image, noindex])
}

export const clip = (s: string, n = 158) => {
  s = s.replace(/\s+/g, " ").trim()
  return s.length > n ? s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:]?$/, "…") : s
}
