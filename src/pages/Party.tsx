// Watch party: everyone in the room watches the same episode in sync with the host, with chat
// (also shown flying over the video) and emoji reactions. Backed by a Durable Object per room
// (worker/social/room.js) over a WebSocket.
import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Copy, Crown, Loader2, Send, Users } from "lucide-react"
import { Container } from "@/components/Section"
import { VideoPlayer } from "@/components/VideoPlayer"
import { AmbientGlow } from "@/components/AmbientGlow"
import { useAuthDialog } from "@/components/social/AuthDialog"
import { Avatar } from "@/components/social/ui"
import { useEpisodes } from "@/lib/api"
import { useDirectStream } from "@/lib/direct"
import { titleOf } from "@/lib/format"
import { animeHref, SITE_NAME, useHead } from "@/lib/seo"
import { sapi, useMe, type StoredAnime, type User } from "@/lib/social"
import { cn } from "@/lib/utils"
import NotFound from "./NotFound"

interface PlayState {
  playing: boolean
  position: number
  at: number
}
interface Room {
  anime: StoredAnime
  episode: number
  lang: "sub" | "dub"
  state: PlayState
  host: string
  createdBy: User
}
interface ChatMsg {
  id: string
  user: { id: string; display_name: string; avatar: string | null }
  body: string
  at: number
}
interface Member {
  id: string
  display_name: string
  username: string
  avatar: string | null
}

// Stable id for this browser's guest identity, so reconnects don't show up as a new person.
function guestId() {
  try {
    let g = localStorage.getItem("ag:gid")
    if (!g) localStorage.setItem("ag:gid", (g = crypto.randomUUID()))
    return g
  } catch {
    return crypto.randomUUID()
  }
}

const REACTIONS = ["😂", "😮", "😭", "🔥", "❤️", "👏", "💀", "😡"]
const DRIFT = 2 // seconds of allowed difference from the host before we seek

export default function Party() {
  const id = useParams().id ?? ""
  const { data: me, isLoading: meLoading } = useMe()
  const [guest, setGuest] = useState<string | null>(null)
  const [name, setName] = useState("")
  const { open } = useAuthDialog()
  const info = useQuery({ queryKey: ["party-info", id], queryFn: () => sapi<{ room: Room; members: number }>(`/rooms/${id}`), retry: false })

  useHead({ title: info.data ? `Watch party: ${titleOf(info.data.room.anime.title)} | ${SITE_NAME}` : `Watch party | ${SITE_NAME}`, noindex: true })

  if (info.error) return <NotFound message="This watch party doesn't exist or has ended." />
  if (meLoading || info.isLoading) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!me && guest === null)
    return (
      <Container className="max-w-md pt-32 text-center">
        <Users className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">You're invited to a watch party</h1>
        {info.data && <p className="mt-2 text-white/55">{titleOf(info.data.room.anime.title)} · Episode {info.data.room.episode} · {info.data.members} watching</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setGuest(name.trim())
          }}
          className="mt-6 flex gap-2"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60" />
          <button className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-white">Join as guest</button>
        </form>
        <button onClick={() => open("Sign in to join with your account.")} className="mt-3 text-sm font-semibold text-white/60 hover:text-white">or sign in</button>
      </Container>
    )
  return <PartyRoom id={id} guestName={me ? undefined : guest ?? ''} />
}

function useRoomSocket(id: string, guestName?: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [you, setYou] = useState<User | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const listeners = useRef(new Set<(m: { t: string; [k: string]: unknown }) => void>())
  const offset = useRef(0) // server clock - local clock, ms

  useEffect(() => {
    let closed = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout>
    const connect = () => {
      const q = guestName === undefined ? "" : `?name=${encodeURIComponent(guestName)}&gid=${guestId()}`
      const s = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/u/rooms/${id}${q}`)
      ws.current = s
      let sentAt = 0
      s.onopen = () => {
        retry = 0
        setConnected(true)
        setError(null)
        sentAt = Date.now()
        s.send(JSON.stringify({ t: "ping" }))
      }
      s.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.t === "pong") offset.current = m.now - (sentAt + (Date.now() - sentAt) / 2)
        if (m.t === "hello") {
          setYou(m.you)
          setRoom(m.room)
          setChat(m.chat)
        }
        if (m.t === "room") setRoom(m.room)
        if (m.t === "state") setRoom((r) => (r ? { ...r, state: m.state } : r))
        if (m.t === "members") {
          setMembers(m.members)
          setRoom((r) => (r ? { ...r, host: m.host } : r))
        }
        if (m.t === "chat") setChat((c) => [...c, m.msg].slice(-150))
        if (m.t === "error") setError(m.message)
        listeners.current.forEach((l) => l(m))
      }
      s.onclose = () => {
        setConnected(false)
        if (closed) return
        timer = setTimeout(connect, Math.min(10_000, 1000 * 2 ** retry++))
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      ws.current?.close()
    }
  }, [id, guestName])

  const send = useCallback((m: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m))
  }, [])
  const subscribe = useCallback((l: (m: { t: string; [k: string]: unknown }) => void) => {
    listeners.current.add(l)
    return () => {
      listeners.current.delete(l)
    }
  }, [])
  return { room, you, members, chat, connected, error, send, subscribe, serverNow: () => Date.now() + offset.current }
}

function PartyRoom({ id, guestName }: { id: string; guestName?: string }) {
  const { room, you, members, chat, connected, error, send, subscribe, serverNow } = useRoomSocket(id, guestName)
  const me: User = you ?? { id: "", username: "", display_name: "", avatar: null, is_admin: false }
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [flying, setFlying] = useState<{ key: string; text: string; lane: number }[]>([])
  const lane = useRef(0)
  const applying = useRef(false)
  const isHost = room?.host === me.id
  const stream = useDirectStream(room?.anime.id ?? 0, room?.episode ?? 0, room?.lang ?? "sub", !!room)
  const episodes = useEpisodes(room?.anime.id)
  const total = episodes.data?.total ?? 0

  // Where the host's playhead is right now.
  const expected = useCallback((s: PlayState) => s.position + (s.playing ? (serverNow() - s.at) / 1000 : 0), [serverNow])

  // Followers: match the host's state.
  const follow = useCallback(
    async (s: PlayState) => {
      if (!video || isHost) return
      applying.current = true
      const target = expected(s)
      if (Math.abs(video.currentTime - target) > DRIFT) video.currentTime = target
      if (s.playing && video.paused) {
        try {
          await video.play()
          setNeedsGesture(false)
        } catch {
          setNeedsGesture(true) // browser blocked autoplay until the viewer interacts
        }
      } else if (!s.playing && !video.paused) video.pause()
      setTimeout(() => (applying.current = false), 300)
    },
    [video, isHost, expected],
  )

  useEffect(() => {
    if (room) void follow(room.state)
  }, [room?.state, follow]) // eslint-disable-line react-hooks/exhaustive-deps

  // Followers drift back if they wander; the host doesn't follow anyone.
  useEffect(() => {
    if (!video || isHost || !room) return
    const t = setInterval(() => void follow(room.state), 2000)
    return () => clearInterval(t)
  }, [video, isHost, room, follow])

  // Host: broadcast play/pause/seek, plus a heartbeat while playing so late joiners line up.
  useEffect(() => {
    if (!video || !isHost) return
    const push = () => send({ t: "sync", playing: !video.paused, position: video.currentTime })
    const events = ["play", "pause", "seeked"] as const
    events.forEach((e) => video.addEventListener(e, push))
    const beat = setInterval(() => !video.paused && push(), 5000)
    return () => {
      events.forEach((e) => video.removeEventListener(e, push))
      clearInterval(beat)
    }
  }, [video, isHost, send])

  // When the host first loads the video, resume from the room's saved position.
  useEffect(() => {
    if (!video || !isHost || !room) return
    const onReady = () => {
      if (Math.abs(video.currentTime - room.state.position) > DRIFT) video.currentTime = room.state.position
    }
    video.addEventListener("loadedmetadata", onReady, { once: true })
    return () => video.removeEventListener("loadedmetadata", onReady)
  }, [video, isHost]) // eslint-disable-line react-hooks/exhaustive-deps

  // Chat and reactions fly across the video.
  useEffect(
    () =>
      subscribe((m) => {
        const text = m.t === "chat" ? `${(m.msg as ChatMsg).user.display_name}: ${(m.msg as ChatMsg).body}` : m.t === "react" ? `${m.emoji as string}` : null
        if (!text) return
        setFlying((f) => [...f, { key: `${Date.now()}-${Math.random()}`, text, lane: lane.current++ % 6 }].slice(-16))
      }),
    [subscribe],
  )

  if (!room) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  const t = titleOf(room.anime.title)
  const changeEpisode = (ep: number) => send({ t: "media", episode: ep, lang: room.lang })

  return (
    <div className="pt-20">
      <Container>
        <nav className="relative z-10 mb-4 flex flex-wrap items-center gap-3 text-[13px]">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-blue/20 px-3 py-1 font-semibold text-[#b3c0ff]"><Users className="size-3.5" />Watch party</span>
          <Link to={animeHref(room.anime)} className="truncate font-semibold text-white/85 hover:text-white">{t}</Link>
          <span className="text-white/45">Episode {room.episode} · {room.lang.toUpperCase()}</span>
          <span className={cn("ml-auto flex items-center gap-1.5 text-xs", connected ? "text-emerald-300" : "text-amber-300")}>
            <span className={cn("size-2 rounded-full", connected ? "bg-emerald-400" : "animate-pulse bg-amber-400")} />
            {connected ? "Connected" : "Reconnecting…"}
          </span>
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="relative isolate">
              <AmbientGlow video={stream.data ? video : null} on />
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                {stream.data ? (
                  <VideoPlayer key={`${room.episode}-${room.lang}`} stream={stream.data} autoplay={false} autoSkipIntro={false} autoSkipOutro={false} onVideo={setVideo}>
                    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 h-[45%] overflow-hidden" aria-hidden>
                      {flying.map((f) => (
                        <span
                          key={f.key}
                          onAnimationEnd={() => setFlying((c) => c.filter((x) => x.key !== f.key))}
                          className="danmaku absolute left-full max-w-[70%] truncate rounded-full bg-black/35 px-3 py-0.5 text-sm font-medium whitespace-nowrap text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
                          style={{ top: `${(f.lane / 6) * 100}%`, animationDuration: "8s" }}
                        >
                          {f.text}
                        </span>
                      ))}
                    </div>
                  </VideoPlayer>
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
                    {stream.isLoading ? <Loader2 className="size-8 animate-spin text-primary" /> : "This episode isn't available on the direct server."}
                  </div>
                )}
                {needsGesture && (
                  <button onClick={() => void follow(room.state)} className="absolute inset-0 z-20 grid place-items-center bg-black/60 text-lg font-semibold">
                    Click to join playback
                  </button>
                )}
              </div>
            </div>

            <div className="relative mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-background/70 p-2 backdrop-blur-xl">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => send({ t: "react", emoji: e })} className="grid size-9 place-items-center rounded-lg text-lg transition hover:scale-110 hover:bg-white/5">{e}</button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {isHost ? (
                  <>
                    <span className="mr-1 text-xs text-white/45">You're the host</span>
                    <button disabled={room.episode <= 1} onClick={() => changeEpisode(room.episode - 1)} className="flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-3 text-xs font-semibold disabled:opacity-30"><ChevronLeft className="size-4" />Prev</button>
                    <button disabled={!!total && room.episode >= total} onClick={() => changeEpisode(room.episode + 1)} className="flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-30">Next<ChevronRight className="size-4" /></button>
                  </>
                ) : (
                  <span className="text-xs text-white/45">The host controls playback</span>
                )}
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
          </div>

          <aside className="flex max-h-[720px] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)]">
            <Members members={members} host={room.host} me={me} isHost={isHost} onTransfer={(to) => send({ t: "transfer", to })} />
            <Chat chat={chat} me={me} onSend={(body) => send({ t: "chat", body, position: video?.currentTime })} />
          </aside>
        </div>
      </Container>
    </div>
  )
}

function Members({ members, host, me, isHost, onTransfer }: { members: Member[]; host: string; me: User; isHost: boolean; onTransfer: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="border-b border-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{members.length} watching</p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold hover:bg-white/10"
        >
          <Copy className="size-3.5" />
          {copied ? "Copied!" : "Invite link"}
        </button>
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
        {members.map((m) => (
          <div key={m.id} className="flex w-14 shrink-0 flex-col items-center gap-1 text-center" title={m.display_name}>
            <div className="relative">
              <Avatar name={m.display_name} src={m.avatar} size={38} />
              {m.id === host && <Crown className="absolute -top-2 -right-1 size-4 fill-amber-300 text-amber-300" />}
            </div>
            <span className="w-full truncate text-[11px] text-white/60">{m.id === me.id ? "You" : m.display_name}</span>
            {isHost && m.id !== me.id && (
              <button onClick={() => onTransfer(m.id)} className="text-[10px] text-primary hover:underline">Make host</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Chat({ chat, me, onSend }: { chat: ChatMsg[]; me: User; onSend: (body: string) => void }) {
  const [text, setText] = useState("")
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [chat.length])
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!chat.length && <p className="pt-10 text-center text-sm text-white/35">Say hi 👋 Messages also fly across the video.</p>}
        {chat.map((m) => (
          <div key={m.id} className="flex gap-2.5">
            <Avatar name={m.user.display_name} src={m.user.avatar} size={28} />
            <div className="min-w-0">
              <p className="text-xs"><span className={cn("font-semibold", m.user.id === me.id ? "text-primary" : "text-white/85")}>{m.user.display_name}</span> <span className="text-white/30">{new Date(m.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></p>
              <p className="text-sm break-words text-white/80">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          onSend(text.trim())
          setText("")
        }}
        className="flex gap-2 border-t border-white/[0.06] p-3"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Message the party…" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm outline-none focus:border-primary/60" />
        <button aria-label="Send" className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Send className="size-4" /></button>
      </form>
    </>
  )
}
