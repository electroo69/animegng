import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AlertTriangle, Captions, ChevronLeft, ChevronRight, Clock, Lightbulb, Loader2, Mic, Search, Server as ServerIcon, Star } from "lucide-react"
import { AnimeCard } from "@/components/AnimeCard"
import { Container, Rail, Section, SectionHeader } from "@/components/Section"
import { BorderBeam } from "@/components/ui/border-beam"
import { embedSrc, useAnime, useEpisodes, useWatch, type Episode, type Server } from "@/lib/api"
import { cap, countdown, formatLabel, score, statusLabel, stripHtml, titleOf } from "@/lib/format"
import { loadPrefs, recordWatch, resumeTime, saveTime, savePrefs, type PlayerPrefs } from "@/lib/progress"
import { cn } from "@/lib/utils"

export default function Watch() {
  const params = useParams()
  const id = Number(params.id)
  const ep = Number(params.ep) || 1
  const navigate = useNavigate()
  const { data, isLoading, isFetching, isPlaceholderData, error } = useWatch(id, ep)
  const anime = useAnime(id)
  const episodes = useEpisodes(id)
  const [prefs, setPrefs] = useState<PlayerPrefs>(loadPrefs)
  const [dim, setDim] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const lastSave = useRef(0)

  const update = (p: Partial<PlayerPrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p }
      savePrefs(next)
      return next
    })

  // While the next episode loads, the previous episode's data is only a placeholder; don't play it.
  const fresh = isPlaceholderData ? undefined : data
  const servers = fresh?.servers
  const hasDub = !!servers?.dub.length
  const lang = prefs.lang === "dub" && hasDub ? "dub" : "sub"
  const list: Server[] = servers?.[lang] ?? []
  const server = list.find((s) => s.name === prefs.server) ?? list[0]

  // Start position is captured once per episode so progress ticks don't reload the iframe.
  const startAt = useMemo(() => resumeTime(id, ep), [id, ep])
  const src = server ? embedSrc(server, { dub: lang === "dub", autoplay: prefs.autoplay, skipIntro: prefs.skipIntro, skipOutro: prefs.skipOutro, startAt }) : null

  const epList = episodes.data?.data ?? []
  const total = episodes.data?.total ?? 0
  const current: Episode | undefined = epList.find((e) => e.episode_number === ep) ?? fresh?.episode ?? undefined
  const next = fresh?.next_episode ?? (ep < total ? ep + 1 : null)
  const prev = ep > 1 ? ep - 1 : null

  // History for "Continue watching".
  useEffect(() => {
    if (!fresh?.anime) return
    const a = fresh.anime
    recordWatch({
      anime: { id: a.id, title: a.title, cover_image: a.cover_image, banner_image: a.banner_image, format: a.format, episodes: a.episodes },
      episode: ep,
      episodeTitle: current?.title ?? null,
      thumbnail: current?.thumbnail ?? null,
    })
  }, [fresh?.anime, ep, current?.title, current?.thumbnail])

  // Player messages: progress ticks (resume + auto-next) and fullscreen requests.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return
      let d = e.data
      if (typeof d === "string") {
        try {
          d = JSON.parse(d)
        } catch {
          return
        }
      }
      if (!d || typeof d !== "object") return
      const cur = Number(d.currentTime ?? (d.type === "time" ? d.time ?? d.position : undefined))
      const dur = Number(d.duration)
      if (cur && dur) {
        if (Date.now() - lastSave.current > 5000) {
          lastSave.current = Date.now()
          saveTime(id, ep, cur, dur)
        }
        if (dur - cur < 1.5 && prefs.autoNext && next) {
          saveTime(id, ep, dur, dur)
          navigate(`/watch/${id}/${next}`)
        }
      }
      // HD-1/HD-2 report {playerStatus: "Playing" | "Paused" | "Ended" ...}; HD-3 sends {type: "complete"}.
      const ended = d.type === "complete" || /end|complete|finish/i.test(String(d.playerStatus ?? ""))
      if (ended && prefs.autoNext && next) navigate(`/watch/${id}/${next}`)
      const cmd = d.zenCommand
      if (cmd) {
        const fs = !!document.fullscreenElement
        if (cmd === "enterFullscreen" || (cmd === "toggleFullscreen" && !fs)) frameRef.current?.requestFullscreen?.()
        else if (cmd === "exitFullscreen" || (cmd === "toggleFullscreen" && fs)) document.exitFullscreen?.()
        else if (cmd === "getFullscreenState") frameRef.current?.contentWindow?.postMessage({ zenFullscreenState: fs }, "*")
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [id, ep, next, prefs.autoNext, navigate])

  const a = anime.data ?? fresh?.anime
  const title = a ? titleOf(a.title) : ""

  useEffect(() => {
    if (title) document.title = `${title} · Episode ${ep} — AnimeGang`
    return () => {
      document.title = "AnimeGang — Watch Anime Free in HD"
    }
  }, [title, ep])

  return (
    <div className="pt-20">
      {dim && <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm" onClick={() => setDim(false)} />}
      <Container>
        <nav className="relative z-10 mb-4 flex items-center gap-2 text-[13px] text-white/45">
          <Link to="/" className="hover:text-white">Home</Link>
          <ChevronRight className="size-3.5" />
          {a ? <Link to={`/anime/${id}`} className="max-w-[40vw] truncate hover:text-white">{title}</Link> : <span className="h-3 w-24 animate-pulse rounded bg-white/10" />}
          <ChevronRight className="size-3.5" />
          <span className="text-white/80">Episode {ep}</span>
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/* Player */}
            <div className={cn("relative isolate", dim && "z-50")}>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
              {src ? (
                <iframe
                  key={src}
                  ref={frameRef}
                  src={src}
                  className="absolute inset-0 size-full"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="origin"
                  // No allow-top-navigation / allow-popups: blocks the host's ad redirects and pop-unders.
                  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock"
                  title={`${title} episode ${ep}`}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  {a?.banner_image && <img src={a.banner_image} alt="" className="absolute inset-0 size-full object-cover opacity-20 blur-sm" />}
                  <div className="relative flex flex-col items-center gap-3 px-6 text-center text-white/70">
                    {isLoading || isFetching ? (
                      <>
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <span className="text-sm">Finding servers…</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-8 text-amber-400" />
                        <span className="font-semibold text-white">{error ? "Couldn't load this episode" : data?.server_error ? "Playback temporarily unavailable" : "This episode isn't available yet"}</span>
                        <span className="text-sm text-white/50">{data?.server_error || "Try another episode, or check back later."}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              <BorderBeam size={160} duration={10} colorFrom="#ff1f2d" colorTo="#2b4bff" borderWidth={1.5} className="pointer-events-none" />
            </div>
            </div>

            {/* Controls */}
            <div className="relative mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-background/70 p-2 backdrop-blur-xl">
              <Toggle on={prefs.autoplay} onClick={() => update({ autoplay: !prefs.autoplay })}>Autoplay</Toggle>
              <Toggle on={prefs.autoNext} onClick={() => update({ autoNext: !prefs.autoNext })}>Auto next</Toggle>
              <Toggle on={prefs.skipIntro} onClick={() => update({ skipIntro: !prefs.skipIntro })}>Skip intro</Toggle>
              <Toggle on={prefs.skipOutro} onClick={() => update({ skipOutro: !prefs.skipOutro })}>Skip outro</Toggle>
              <button onClick={() => setDim(!dim)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white", dim && "text-amber-300")}>
                <Lightbulb className="size-3.5" />
                Lights
              </button>
              <div className="ml-auto flex gap-1">
                <NavBtn disabled={!prev} onClick={() => prev && navigate(`/watch/${id}/${prev}`)}>
                  <ChevronLeft className="size-4" /> Prev
                </NavBtn>
                <NavBtn disabled={!next} onClick={() => next && navigate(`/watch/${id}/${next}`)} primary>
                  Next <ChevronRight className="size-4" />
                </NavBtn>
              </div>
            </div>

            {/* Servers */}
            <div className="mt-3 grid gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.03] to-transparent p-4 sm:grid-cols-[220px_1fr] sm:p-5">
              <div className="rounded-xl bg-primary/10 p-4 text-center sm:text-left">
                <p className="text-xs text-white/50">You are watching</p>
                <p className="mt-0.5 font-bold text-primary">Episode {ep}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/45">If the current server doesn't load, try another one.</p>
              </div>
              <div className="space-y-3">
                <ServerRow icon={Captions} label="SUB" servers={servers?.sub ?? []} active={lang === "sub" ? server?.name : undefined} onPick={(s) => update({ lang: "sub", server: s.name })} loading={!servers} />
                <ServerRow icon={Mic} label="DUB" servers={servers?.dub ?? []} active={lang === "dub" ? server?.name : undefined} onPick={(s) => update({ lang: "dub", server: s.name })} loading={!servers} />
              </div>
            </div>

            {a?.next_airing_episode && (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-2.5 text-sm text-[#a9b8ff]">
                <Clock className="size-4" />
                Episode {a.next_airing_episode.episode} airs in {countdown(a.next_airing_episode.time_until_airing)} ({new Date(a.next_airing_episode.airing_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })})
              </p>
            )}

            {/* Episode + anime info */}
            <div className="mt-6 flex flex-col gap-5 sm:flex-row">
              {a && (
                <Link to={`/anime/${id}`} className="w-28 shrink-0 self-start">
                  <img src={a.cover_image.extra_large} alt="" className="aspect-[2/3] w-full rounded-xl object-cover ring-1 ring-white/10" />
                </Link>
              )}
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">Episode {ep}{current?.title ? ` · ${current.title}` : ""}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
                {a && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                    {score(a.average_score) && (
                      <span className="flex items-center gap-1 text-amber-300">
                        <Star className="size-3 fill-current" />
                        {score(a.average_score)}
                      </span>
                    )}
                    <span>{formatLabel(a.format)}</span>
                    <span>· {statusLabel(a.status)}</span>
                    {a.season && <span>· {cap(a.season)} {a.season_year}</span>}
                  </div>
                )}
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/60">{current?.description || stripHtml(anime.data?.description)}</p>
                {current?.aired && <p className="mt-2 text-xs text-white/35">Aired {new Date(current.aired).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>}
              </div>
            </div>
          </div>

          <EpisodePanel animeId={id} current={ep} episodes={epList} total={total} loading={episodes.isLoading} />
        </div>

        {anime.data?.recommendations.length ? (
          <Section className="mt-16">
            <SectionHeader eyebrow="Up next" title="You might also like" />
            <Rail>
              {anime.data.recommendations.map((r) => (
                <div key={r.id} className="w-[42vw] shrink-0 snap-start sm:w-[190px]">
                  <AnimeCard anime={r} />
                </div>
              ))}
            </Rail>
          </Section>
        ) : null}
      </Container>
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white">
      <span className={cn("relative h-4 w-7 rounded-full transition", on ? "bg-primary" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
      {children}
    </button>
  )
}

function NavBtn({ disabled, onClick, primary, children }: { disabled: boolean; onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-30",
        primary ? "bg-primary text-white hover:bg-primary/85" : "bg-white/[0.06] text-white/80 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  )
}

function ServerRow({ icon: Icon, label, servers, active, onPick, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; servers: Server[]; active?: string; onPick: (s: Server) => void; loading: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex w-16 items-center gap-1.5 text-xs font-bold text-white/50">
        <Icon className="size-4" />
        {label}
      </span>
      {loading ? (
        <span className="h-8 w-40 animate-pulse rounded-lg bg-white/[0.05]" />
      ) : servers.length ? (
        servers.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition",
              active === s.name ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white",
            )}
          >
            <ServerIcon className="size-3" />
            {s.name}
          </button>
        ))
      ) : (
        <span className="text-xs text-white/35">Not available</span>
      )}
    </div>
  )
}

const CHUNK = 100

function EpisodePanel({ animeId, current, episodes, total, loading }: { animeId: number; current: number; episodes: Episode[]; total: number; loading: boolean }) {
  const [q, setQ] = useState("")
  const [range, setRange] = useState(() => Math.floor((current - 1) / CHUNK))
  const activeRef = useRef<HTMLAnchorElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const ranges = Math.ceil(total / CHUNK)
  const compact = total > 30

  useEffect(() => {
    setRange(Math.floor((current - 1) / CHUNK))
  }, [current])

  // Keep the current episode in view inside the panel (without scrolling the page).
  useEffect(() => {
    const el = activeRef.current
    const box = listRef.current
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" })
  }, [current, range, loading])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t) return episodes.filter((e) => String(e.episode_number).startsWith(t) || e.title?.toLowerCase().includes(t))
    return episodes.slice(range * CHUNK, range * CHUNK + CHUNK)
  }, [episodes, q, range])

  return (
    <aside className="flex max-h-[720px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] xl:max-h-[calc(100vh-7rem)] xl:sticky xl:top-20">
      <div className="space-y-3 border-b border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Episodes</h2>
          <span className="font-mono text-xs text-white/40">{total} total</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number or title" className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] pr-3 pl-8 text-sm outline-none placeholder:text-white/30 focus:border-primary/60" />
          </div>
          {ranges > 1 && (
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="h-9 rounded-lg border border-white/10 bg-[#15151c] px-2 font-mono text-xs outline-none">
              {Array.from({ length: ranges }, (_, n) => (
                <option key={n} value={n}>
                  {n * CHUNK + 1}-{Math.min(total, (n + 1) * CHUNK)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div ref={listRef} className="relative flex-1 overflow-y-auto p-2">
        {loading && <div className="space-y-2 p-2">{Array.from({ length: 8 }, (_, n) => <div key={n} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />)}</div>}
        {compact && !q ? (
          <div className="grid grid-cols-5 gap-1.5 p-1">
            {shown.map((e) => (
              <Link
                key={e.episode_number}
                ref={e.episode_number === current ? activeRef : undefined}
                to={`/watch/${animeId}/${e.episode_number}`}
                title={e.title ?? undefined}
                className={cn(
                  "grid h-10 place-items-center rounded-lg font-mono text-sm font-medium transition",
                  e.episode_number === current ? "bg-primary text-white" : e.is_filler ? "bg-amber-500/10 text-amber-200/80 hover:bg-amber-500/20" : "bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {e.episode_number}
              </Link>
            ))}
          </div>
        ) : (
          shown.map((e) => {
            const on = e.episode_number === current
            return (
              <Link
                key={e.episode_number}
                ref={on ? activeRef : undefined}
                to={`/watch/${animeId}/${e.episode_number}`}
                className={cn("group flex items-center gap-3 rounded-xl p-2 transition", on ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-white/[0.04]")}
              >
                <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                  {e.thumbnail && <img src={e.thumbnail} alt="" loading="lazy" className="size-full object-cover" />}
                  <span className={cn("absolute bottom-1 left-1 rounded bg-black/70 px-1 font-mono text-[10px]", on && "bg-primary")}>{e.episode_number}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("line-clamp-2 text-[13px] leading-snug", on ? "font-semibold text-white" : "text-white/75 group-hover:text-white")}>{e.title || `Episode ${e.episode_number}`}</p>
                  {e.is_filler && <span className="mt-1 inline-block rounded bg-amber-500/90 px-1 text-[9px] font-bold text-black">FILLER</span>}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </aside>
  )
}
