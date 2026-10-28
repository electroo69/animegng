// Cookie consent: Google Analytics runs in consent mode, denied until the visitor accepts here.
import { useState } from "react"
import { Link } from "react-router-dom"

const KEY = "ag:consent"
const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return "no"
  }
}

export function ConsentBanner() {
  const [choice, setChoice] = useState(read)
  if (choice) return null
  const decide = (v: "yes" | "no") => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* ignore */
    }
    ;(window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("consent", "update", { analytics_storage: v === "yes" ? "granted" : "denied" })
    setChoice(v)
  }
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-popover/95 p-4 text-sm shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
      <p className="flex-1 text-white/70">
        We use a cookie to keep you signed in and, if you allow it, analytics to see which pages people use. <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy policy</Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => decide("no")} className="h-9 rounded-lg border border-white/15 px-4 font-semibold text-white/80 hover:bg-white/5">Essential only</button>
        <button onClick={() => decide("yes")} className="h-9 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary/85">Accept</button>
      </div>
    </div>
  )
}
