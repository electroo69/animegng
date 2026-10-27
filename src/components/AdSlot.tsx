// Adsterra display banners, placed only in reserved boxes between content: never over the
// player, never popunders/overlays. Each banner runs in its own sandboxed iframe so
//  - its global `atOptions` doesn't clash with other units on the page,
//  - its script can't touch or redirect our page (no allow-top-navigation / allow-same-origin),
//  - clicks still open the advertiser in a new tab (allow-popups-to-escape-sandbox).
// Banners load only when scrolled near, so they don't slow down the first paint or the player.
// The banner page is public/ad.html on our own domain: Adsterra only fills requests whose referrer
// is the registered site (animegng.pages.dev), which an inline srcdoc frame doesn't send.
// On localhost the slots stay empty.
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const UNITS = {
  "728x90": { key: "549146a95ff974479313fc83e8837165", w: 728, h: 90 },
  "320x50": { key: "c1933f36287324f87f8917a9376aaafc", w: 320, h: 50 },
  "300x250": { key: "11db9680081c2e59af84aae096a3d32b", w: 300, h: 250 },
  "468x60": { key: "ed0de7a4bcb36d96f282ef9ca4b9f1ce", w: 468, h: 60 },
  "160x600": { key: "a41ce23f0571af075fca48e54a339202", w: 160, h: 600 },
  "160x300": { key: "c56e115f3c10d8da72a1e37954006090", w: 160, h: 300 },
} as const

export type AdSize = keyof typeof UNITS

export function AdSlot({ size, className }: { size: AdSize; className?: string }) {
  const { key, w, h } = UNITS[size]
  const box = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || show) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show])

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="mb-1 text-[10px] tracking-widest text-white/25 uppercase">Advertisement</span>
      <div ref={box} style={{ width: w, height: h }} className="max-w-full overflow-hidden rounded-md bg-white/[0.02]">
        {show && (
          <iframe
            title="Advertisement"
            src={`/ad.html?k=${key}&w=${w}&h=${h}`}
            width={w}
            height={h}
            loading="lazy"
            scrolling="no"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className="block border-0"
          />
        )}
      </div>
    </div>
  )
}

// 728x90 on wide screens, 320x50 on phones. Hidden slots never load (display:none never intersects).
export function LeaderboardAd({ className }: { className?: string }) {
  return (
    <div className={className}>
      <AdSlot size="728x90" className="hidden md:flex" />
      <AdSlot size="320x50" className="md:hidden" />
    </div>
  )
}
