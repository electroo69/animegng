// Live comments: timestamped comments fly across the top of the video as playback reaches their
// moment (danmaku style). Rendered inside the player so they also show in fullscreen.
import { useEffect, useRef, useState } from "react"
import type { LiveComment } from "@/lib/social"

const LANES = 6
const MAX_ON_SCREEN = 14
const DURATION = 9 // seconds to cross the screen

interface Flying {
  key: string
  text: string
  lane: number
}

export function LiveCommentsOverlay({ items, video, enabled }: { items: LiveComment[]; video: HTMLVideoElement | null; enabled: boolean }) {
  const [flying, setFlying] = useState<Flying[]>([])
  const last = useRef(0)
  const lane = useRef(0)

  useEffect(() => {
    if (!video || !enabled) return
    last.current = video.currentTime
    const onTime = () => {
      const prev = last.current
      const time = video.currentTime
      last.current = time
      // Only spawn on normal forward playback; a seek just moves the cursor.
      if (time < prev || time - prev > 2) return
      const due = items.filter((c) => c.ts > prev && c.ts <= time && !c.spoiler)
      if (!due.length) return
      setFlying((cur) => {
        const add = due.map((c) => ({ key: `${c.id}-${time}`, text: `${c.display_name}: ${c.body}`, lane: lane.current++ % LANES }))
        return [...cur, ...add].slice(-MAX_ON_SCREEN)
      })
    }
    video.addEventListener("timeupdate", onTime)
    return () => video.removeEventListener("timeupdate", onTime)
  }, [video, items, enabled])

  if (!enabled) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 h-[45%] overflow-hidden" aria-hidden>
      {flying.map((f) => (
        <span
          key={f.key}
          onAnimationEnd={() => setFlying((cur) => cur.filter((x) => x.key !== f.key))}
          className="danmaku absolute left-full max-w-[70%] truncate rounded-full bg-black/35 px-3 py-0.5 text-sm font-medium whitespace-nowrap text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
          style={{ top: `${(f.lane / LANES) * 100}%`, animationDuration: `${DURATION}s` }}
        >
          {f.text}
        </span>
      ))}
    </div>
  )
}
