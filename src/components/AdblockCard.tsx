// A friendly ask shown to visitors with an ad blocker. It never blocks the site: the close button hides it for a few days.
// Detection runs as soon as the app mounts, which is after first paint (main.tsx). Two checks, as blockers work in different ways:
// a request to the ad host (network filters) and a bait element (cosmetic filters).
import { useEffect, useState } from "react"
import { HeartHandshake, X } from "lucide-react"
import { useLocation } from "react-router-dom"

const KEY = "ag:adblock-later"
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 2000
const AD_URL = "https://bauval.org/22/549146a95ff974479313fc83e8837165"

const snoozed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS
  } catch {
    return false
  }
}

async function adsBlocked() {
  // Started first so a bait hit answers at once. Some blockers leave the request hanging instead of failing it,
  // so a slow answer counts as blocked. Being offline fails the same way, and isn't an ad blocker.
  const request = fetch(AD_URL, { method: "HEAD", mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(TIMEOUT_MS) }).then(
    () => false,
    () => navigator.onLine,
  )
  const bait = document.createElement("div")
  bait.className = "adsbox ad-banner pub_300x250 text-ad"
  bait.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px"
  document.body.append(bait)
  await new Promise((r) => setTimeout(r, 100))
  const hidden = bait.offsetHeight === 0
  bait.remove()
  return hidden || request
}

export function AdblockCard() {
  const manga = useLocation().pathname.startsWith("/manga")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (snoozed()) return
    let live = true
    adsBlocked().then((blocked) => {
      if (live && blocked) setOpen(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (!open) return null
  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setOpen(false)
  }
  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="adblock-title" className="relative w-full max-w-md rounded-2xl border border-white/10 bg-popover p-6 shadow-2xl sm:p-7">
        <button onClick={later} aria-label="Close" className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-white">
          <X className="size-3.5" />
        </button>
        <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
          <HeartHandshake className="size-6" />
        </span>
        <h2 id="adblock-title" className="mt-4 text-xl font-bold text-white">Please disable your ad blocker</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">
          <p>
            {manga
              ? "We built MangaGang for the chapters you read long past bedtime, the panels that stay with you, and the characters who start to feel like old friends."
              : "We built AnimeGang for the episodes you stay up too late for, the endings that stay with you, and the characters who start to feel like old friends."}
          </p>
          <p>There's no paywall and no subscription here. A few quiet ads are what keep the lights on, and your ad blocker is stopping them.</p>
          <p className="text-white/90">If this place has given you a good night or two, please disable your ad blocker for this site. It means more than you know.</p>
        </div>
        <button onClick={() => location.reload()} className="mt-6 h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85">I've disabled it</button>
      </div>
    </div>
  )
}
