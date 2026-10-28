// Small shared pieces for the social features: avatar, dropdown, relative time.
import { useEffect, useRef, useState, type ReactNode } from "react"
import { initials } from "@/lib/social"
import { cn } from "@/lib/utils"

const HUES = ["#ff1f2d", "#2b4bff", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#06b6d4"]
const hue = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]

export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: hue(name), fontSize: size * 0.42 }}
    >
      {initials(name)}
    </span>
  )
}

/** A click-to-open panel anchored to its trigger; closes on outside click or Escape. */
export function Dropdown({ trigger, children, align = "right", className }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger(open)}</div>
      {open && (
        <div className={cn("absolute top-full z-50 mt-2 rounded-xl border border-white/10 bg-popover/95 shadow-2xl backdrop-blur-xl", align === "right" ? "right-0" : "left-0", className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function ago(ms: number) {
  const s = (Date.now() - ms) / 1000
  if (s < 60) return "just now"
  for (const [n, u] of [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]] as const) if (s >= n) return `${Math.floor(s / n)}${u} ago`
  return "just now"
}
