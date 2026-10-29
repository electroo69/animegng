// Our own HLS player for direct streams: quality, subtitles, speed, skip intro/outro, resume,
// keyboard shortcuts. Used instead of a third-party iframe when a direct stream exists.
import { useCallback, useEffect, useRef, useState } from "react"
import Hls, { type Level, type LoaderResponse, type RetryConfig } from "hls.js"
import { Captions, Check, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Settings, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react"
import type { DirectStream } from "@/lib/direct"
import { cn } from "@/lib/utils"

const PREF_KEY = "ag:video"
type VideoPrefs = { volume: number; muted: boolean; subtitle: string; rate: number }
const loadVideoPrefs = (): VideoPrefs => {
  try {
    return { volume: 1, muted: false, subtitle: "English", rate: 1, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }
  } catch {
    return { volume: 1, muted: false, subtitle: "English", rate: 1 }
  }
}
const saveVideoPrefs = (p: VideoPrefs) => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// The stream proxy answers 429 for a few seconds when one IP loads playlists in quick succession.
// hls.js doesn't retry 4xx by default, so retry 429s with backoff before giving up.
const retry429 = (maxNumRetry: number) => ({
  maxNumRetry,
  retryDelayMs: 1500,
  maxRetryDelayMs: 12000,
  backoff: "exponential" as const,
  shouldRetry: (cfg: RetryConfig | null | undefined, count: number, _timeout: boolean, res: LoaderResponse | undefined, retry: boolean) =>
    retry || (res?.code === 429 && count < (cfg?.maxNumRetry ?? 0)),
})
const loadPolicy = (maxNumRetry: number, ttfb: number, total: number) => ({
  default: {
    maxTimeToFirstByteMs: ttfb,
    maxLoadTimeMs: total,
    timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
    errorRetry: retry429(maxNumRetry),
  },
})

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00"
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, "0")
  return h ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`
}

interface Props {
  stream: DirectStream
  poster?: string | null
  startAt?: number
  autoplay: boolean
  autoSkipIntro: boolean
  autoSkipOutro: boolean
  onProgress?: (current: number, duration: number) => void
  onEnded?: () => void
  onFatalError?: () => void
  /** Receives the underlying <video> element (e.g. for the ambient glow). */
  onVideo?: (video: HTMLVideoElement | null) => void
  /** Watch-party guests: play/pause/seek/skip are disabled (the host controls playback). */
  locked?: boolean
  /** Overlay rendered inside the player (so it also shows in fullscreen), e.g. live comments. */
  children?: React.ReactNode
}

export function VideoPlayer({ stream, poster, startAt = 0, autoplay, autoSkipIntro, autoSkipOutro, onProgress, onEnded, onFatalError, onVideo, children, locked = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hls = useRef<Hls | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [prefs, setPrefs] = useState(loadVideoPrefs)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [levels, setLevels] = useState<Level[]>([])
  const [level, setLevel] = useState(-1) // -1 = auto
  const [menu, setMenu] = useState<null | "settings" | "subs">(null)
  const [controls, setControls] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Subtitle files load only once video is playing, so they don't compete with the first segment.
  const [subsReady, setSubsReady] = useState(false)

  const updatePrefs = (p: Partial<VideoPrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p }
      saveVideoPrefs(next)
      return next
    })

  useEffect(() => {
    onVideo?.(video.current)
    return () => onVideo?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the stream.
  useEffect(() => {
    const v = video.current
    if (!v) return
    setError(null)
    setSubsReady(false)
    setWaiting(true)
    setLevels([])
    setLevel(-1)
    const begin = () => {
      if (startAt > 0) v.currentTime = startAt
      if (autoplay) v.play().catch(() => setPlaying(false))
    }
    if (Hls.isSupported()) {
      const h = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        startLevel: -1,
        startFragPrefetch: true,
        manifestLoadPolicy: loadPolicy(4, 10000, 20000),
        playlistLoadPolicy: loadPolicy(4, 10000, 20000),
        fragLoadPolicy: loadPolicy(6, 10000, 120000),
      })
      hls.current = h
      h.loadSource(stream.url)
      h.attachMedia(v)
      h.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels)
        begin()
      })
      let recovered = false
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true
          h.recoverMediaError()
          return
        }
        setError("This stream couldn't be played.")
        onFatalError?.()
      })
      return () => {
        h.destroy()
        hls.current = null
      }
    }
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively.
      v.src = stream.url
      v.addEventListener("loadedmetadata", begin, { once: true })
      return () => {
        v.removeAttribute("src")
        v.load()
      }
    }
    setError("Your browser can't play this stream.")
    onFatalError?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url])

  // Volume / rate prefs.
  useEffect(() => {
    const v = video.current
    if (!v) return
    v.volume = prefs.volume
    v.muted = prefs.muted
    v.playbackRate = prefs.rate
  }, [prefs.volume, prefs.muted, prefs.rate])

  // Subtitle selection by label ("Off" disables all).
  const applySubs = useCallback(() => {
    const v = video.current
    if (!v) return
    const tracks = Array.from(v.textTracks)
    const want = tracks.find((t) => t.label === prefs.subtitle) ?? (prefs.subtitle === "Off" ? undefined : tracks.find((t) => /english/i.test(t.label)))
    for (const t of tracks) t.mode = t === want ? "showing" : "disabled"
  }, [prefs.subtitle])
  useEffect(() => {
    applySubs()
    const v = video.current
    v?.textTracks.addEventListener("addtrack", applySubs)
    return () => v?.textTracks.removeEventListener("addtrack", applySubs)
  }, [applySubs, stream.subtitles])

  // Auto-skip intro/outro once per stream.
  const skipped = useRef({ intro: false, outro: false })
  useEffect(() => {
    skipped.current = { intro: false, outro: false }
  }, [stream.url])

  const onTime = () => {
    const v = video.current!
    setTime(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    onProgress?.(v.currentTime, v.duration)
    const t = v.currentTime
    if (autoSkipIntro && stream.intro && !skipped.current.intro && t >= stream.intro.start && t < stream.intro.end - 1) {
      skipped.current.intro = true
      v.currentTime = stream.intro.end
    }
    if (autoSkipOutro && stream.outro && !skipped.current.outro && t >= stream.outro.start && t < stream.outro.end - 1) {
      skipped.current.outro = true
      v.currentTime = stream.outro.end
    }
  }

  const toggle = useCallback(() => {
    const v = video.current
    if (!v || locked) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [locked])
  const seekBy = useCallback((d: number) => {
    const v = video.current
    if (v && !locked) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d))
  }, [locked])
  const toggleFs = useCallback(() => {
    type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
    type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void }
    const d = document as FsDoc
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      ;(d.exitFullscreen?.bind(d) ?? d.webkitExitFullscreen?.bind(d))?.()
      return
    }
    const el = wrap.current as FsEl | null
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (el?.requestFullscreen) {
      el.requestFullscreen()
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => {}))
        .catch(() => v?.webkitEnterFullscreen?.())
    } else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    else v?.webkitEnterFullscreen?.()
  }, [])

  // Show controls on activity, hide after a pause while playing.
  const poke = useCallback(() => {
    setControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!video.current?.paused) {
        setControls(false)
        setMenu(null)
      }
    }, 2800)
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen((document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) === wrap.current)
    document.addEventListener("fullscreenchange", onFs)
    document.addEventListener("webkitfullscreenchange", onFs)
    return () => {
      document.removeEventListener("fullscreenchange", onFs)
      document.removeEventListener("webkitfullscreenchange", onFs)
    }
  }, [])

  // Keyboard shortcuts while the page (not an input) has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey) return
      const v = video.current
      if (!v) return
      const k = e.key.toLowerCase()
      const handled = true
      if (k === " " || k === "k") toggle()
      else if (k === "arrowleft" || k === "j") seekBy(k === "j" ? -10 : -5)
      else if (k === "arrowright" || k === "l") seekBy(k === "l" ? 10 : 5)
      else if (k === "arrowup") updatePrefs({ volume: Math.min(1, prefs.volume + 0.1), muted: false })
      else if (k === "arrowdown") updatePrefs({ volume: Math.max(0, prefs.volume - 0.1) })
      else if (k === "m") updatePrefs({ muted: !prefs.muted })
      else if (k === "f") toggleFs()
      else if (k === "c") updatePrefs({ subtitle: prefs.subtitle === "Off" ? "English" : "Off" })
      else if (k === "s" && !locked) {
        const seg = activeSegment()
        if (seg) v.currentTime = seg.end
        else return
      } else return
      if (handled) {
        e.preventDefault()
        poke()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const activeSegment = () => {
    for (const s of [stream.intro, stream.outro]) if (s && time >= s.start && time < s.end - 1) return s
    return null
  }
  const seg = activeSegment()
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0)
  const VolIcon = prefs.muted || prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2
  const qualityLabel = level === -1 ? `Auto${hls.current && hls.current.currentLevel >= 0 && levels[hls.current.currentLevel] ? ` (${levels[hls.current.currentLevel].height}p)` : ""}` : `${levels[level]?.height}p`
  const showUi = controls || !playing || !!menu

  return (
    <div
      ref={wrap}
      className={cn("group/player absolute inset-0 overflow-hidden bg-black select-none", showUi ? "player-ui-on" : "cursor-none")}
      onMouseMove={poke}
      onMouseLeave={() => playing && setControls(false)}
    >
      <video
        ref={video}
        className="size-full"
        crossOrigin="anonymous"
        playsInline
        poster={poster ?? undefined}
        onClick={() => (menu ? setMenu(null) : toggle())}
        onDoubleClick={toggleFs}
        onPlay={() => {
          setPlaying(true)
          poke()
        }}
        onPause={() => {
          setPlaying(false)
          setControls(true)
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false)
          setSubsReady(true)
        }}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={onTime}
        onEnded={onEnded}
      >
        {subsReady && stream.subtitles.map((s) => (
          <track key={s.url} kind="subtitles" src={s.url} label={s.label} srcLang={s.label.slice(0, 2).toLowerCase()} />
        ))}
      </video>

      <div className={cn("contents", !playing && "[&_.danmaku]:[animation-play-state:paused]")}>{children}</div>

      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-10 animate-spin text-white/80" />
        </div>
      )}
      {!playing && !waiting && !error && !locked && (
        <button onClick={toggle} aria-label="Play" className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-primary/90 text-white transition hover:scale-105">
          <Play className="ml-1 size-7 fill-white" />
        </button>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 px-6 text-center text-sm text-white/80">{error}</div>
      )}

      {seg && !locked && (
        <button
          onClick={() => {
            if (video.current) video.current.currentTime = seg.end
          }}
          className="absolute right-5 bottom-24 flex items-center gap-2 rounded-lg border border-white/20 bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black"
        >
          <SkipForward className="size-4" />
          {seg === stream.intro ? "Skip intro" : "Skip outro"}
        </button>
      )}

      {/* Bottom controls */}
      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pt-10 pb-1.5 transition-opacity sm:px-4 sm:pt-14 sm:pb-3 duration-300", showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
        {/* Seek bar */}
        <div
          className={cn("group/seek relative mb-1 h-6 touch-none sm:mb-2 sm:h-4", locked ? "cursor-not-allowed" : "cursor-pointer")}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left))
            setHover({ x, t: (x / r.width) * duration })
          }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            if (video.current && duration && !locked) video.current.currentTime = ((e.clientX - r.left) / r.width) * duration
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20 transition-all group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${pct(buffered)}%` }} />
            {[stream.intro, stream.outro].map((s, n) =>
              s ? <div key={n} className="absolute inset-y-0 bg-brand-blue/70" style={{ left: `${pct(s.start)}%`, width: `${pct(s.end - s.start)}%` }} /> : null,
            )}
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct(time)}%` }} />
          </div>
          <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-primary transition group-hover/seek:scale-100" style={{ left: `${pct(time)}%` }} />
          {hover && (
            <span className="absolute -top-8 -translate-x-1/2 rounded bg-black/85 px-2 py-0.5 font-mono text-xs text-white" style={{ left: hover.x }}>
              {fmt(hover.t)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-white">
          <CtrlBtn label={playing ? "Pause (k)" : "Play (k)"} onClick={toggle}>
            {playing ? <Pause className="size-5 fill-white" /> : <Play className="size-5 fill-white" />}
          </CtrlBtn>
          <CtrlBtn label="Back 10s (j)" onClick={() => seekBy(-10)} className="hidden sm:grid">
            <RotateCcw className="size-[18px]" />
          </CtrlBtn>
          <CtrlBtn label="Forward 10s (l)" onClick={() => seekBy(10)} className="hidden sm:grid">
            <RotateCw className="size-[18px]" />
          </CtrlBtn>
          <div className="group/vol hidden items-center sm:flex">
            <CtrlBtn label="Mute (m)" onClick={() => updatePrefs({ muted: !prefs.muted })}>
              <VolIcon className="size-5" />
            </CtrlBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.muted ? 0 : prefs.volume}
              onChange={(e) => updatePrefs({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })}
              aria-label="Volume"
              className="w-0 accent-primary opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          </div>
          <span className="ml-1 truncate font-mono text-[11px] text-white/80 tabular-nums sm:ml-2 sm:text-xs">
            {fmt(time)} / {fmt(duration)}
          </span>

          <div className="relative ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {stream.subtitles.length > 0 && (
              <CtrlBtn label="Subtitles (c)" onClick={() => setMenu(menu === "subs" ? null : "subs")} active={prefs.subtitle !== "Off"}>
                <Captions className="size-5" />
              </CtrlBtn>
            )}
            <CtrlBtn label="Settings" onClick={() => setMenu(menu === "settings" ? null : "settings")}>
              <Settings className={cn("size-5 transition", menu === "settings" && "rotate-45")} />
            </CtrlBtn>
            {document.pictureInPictureEnabled && (
              <CtrlBtn label="Picture in picture" className="hidden sm:grid" onClick={() => (document.pictureInPictureElement ? document.exitPictureInPicture() : video.current?.requestPictureInPicture())}>
                <PictureInPicture2 className="size-5" />
              </CtrlBtn>
            )}
            <CtrlBtn label="Fullscreen (f)" onClick={toggleFs}>
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </CtrlBtn>

            {menu === "subs" && (
              <Menu title="Subtitles">
                {["Off", ...stream.subtitles.map((s) => s.label)].map((l) => (
                  <MenuItem key={l} on={prefs.subtitle === l} onClick={() => updatePrefs({ subtitle: l })}>
                    {l}
                  </MenuItem>
                ))}
              </Menu>
            )}
            {menu === "settings" && (
              <Menu title="Settings">
                <p className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">Quality · {qualityLabel}</p>
                <MenuItem
                  on={level === -1}
                  onClick={() => {
                    if (hls.current) hls.current.currentLevel = -1
                    setLevel(-1)
                  }}
                >
                  Auto
                </MenuItem>
                {levels
                  .map((l, i) => ({ l, i }))
                  .sort((a, b) => b.l.height - a.l.height)
                  .map(({ l, i }) => (
                    <MenuItem
                      key={i}
                      on={level === i}
                      onClick={() => {
                        if (hls.current) hls.current.currentLevel = i
                        setLevel(i)
                      }}
                    >
                      {l.height}p
                    </MenuItem>
                  ))}
                <p className="mt-1 border-t border-white/10 px-3 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">Speed</p>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button key={r} onClick={() => updatePrefs({ rate: r })} className={cn("rounded-md px-2 py-1 font-mono text-xs", prefs.rate === r ? "bg-primary text-white" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                      {r}x
                    </button>
                  ))}
                </div>
              </Menu>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CtrlBtn({ label, onClick, active, className, children }: { label: string; onClick: () => void; active?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn("grid size-9 place-items-center rounded-lg transition hover:bg-white/15", active && "text-primary", className)}>
      {children}
    </button>
  )
}

function Menu({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute right-0 bottom-12 z-10 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-black/90 py-2 text-sm shadow-2xl backdrop-blur-xl">
      <p className="px-3 pb-1 text-xs font-semibold text-white/60">{title}</p>
      {children}
    </div>
  )
}

function MenuItem({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-white/10", on ? "text-white" : "text-white/70")}>
      <Check className={cn("size-3.5 text-primary", !on && "opacity-0")} />
      {children}
    </button>
  )
}
