// YouTube/animetsu-style ambient light behind the player. Each decoded video frame is drawn onto a
// small 300x150 canvas (requestVideoFrameCallback, so it follows the video's frame rate), which is
// blurred, saturated and stretched past the player's edges, with a dark overlay on top.
// Only works with our own <video> (direct streams): the stream is CORS-enabled and the element is
// crossOrigin="anonymous", so the canvas isn't tainted. Embed servers are cross-origin iframes.
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Tuned in the ambient demo: brightness 100%, blur 61px, saturation 200%, spread 1.24, dim 55%. Spread later reduced to 1.12 (tighter glow).
const BLUR = 61
const SATURATE = 200
const BRIGHTNESS = 100
const SPREAD = 1.12
const DIM = 0.55
const W = 300
const H = 150

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

export function AmbientGlow({ video, on }: { video: HTMLVideoElement | null; on: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = video as FrameVideo | null
    const ctx = canvas.current?.getContext("2d")
    if (!v || !ctx || !on) return
    let stopped = false
    let handle = 0
    let raf = 0

    const draw = () => {
      if (v.readyState < 2) return
      try {
        ctx.drawImage(v, 0, 0, W, H)
        setReady(true)
      } catch {
        // A tainted (non-CORS) source can't be read; leave the glow off.
        stopped = true
      }
    }
    const loop = () => {
      if (stopped) return
      draw()
      if (v.requestVideoFrameCallback) handle = v.requestVideoFrameCallback(loop)
      else raf = requestAnimationFrame(loop)
    }

    draw()
    loop()
    // Paused video produces no new frames; keep the glow in sync with seeks and stream switches.
    v.addEventListener("seeked", draw)
    v.addEventListener("loadeddata", draw)
    return () => {
      stopped = true
      if (handle) v.cancelVideoFrameCallback?.(handle)
      cancelAnimationFrame(raf)
      v.removeEventListener("seeked", draw)
      v.removeEventListener("loadeddata", draw)
    }
  }, [video, on])

  useEffect(() => {
    if (!video) setReady(false)
  }, [video])

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300", on && ready ? "opacity-100" : "opacity-0")}>
      <div
        className="relative size-full"
        style={{ filter: `blur(${BLUR}px) saturate(${SATURATE}%) brightness(${BRIGHTNESS}%)`, scale: `${SPREAD * 0.96} ${SPREAD * 1.04}` }}
      >
        <canvas ref={canvas} width={W} height={H} className="size-full" />
        <div className="absolute inset-0" style={{ background: `rgba(0, 0, 0, ${DIM})` }} />
      </div>
    </div>
  )
}
