// Episode likes and the comment section (threads one level deep, top/new sort, spoilers, votes,
// reports, deletion). "Live" comments are ordinary comments pinned to a timestamp (see LiveComments).
import { useEffect, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Flag, Loader2, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { useRequireAuth } from "@/components/social/AuthDialog"
import { Avatar, ago } from "@/components/social/ui"
import { sapi, useEpisodeVotes, useMe, type Comment } from "@/lib/social"
import { cn } from "@/lib/utils"

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

export function EpisodeVotes({ anime, ep }: { anime: number; ep: number }) {
  const { data } = useEpisodeVotes(anime, ep)
  const qc = useQueryClient()
  const requireAuth = useRequireAuth()
  const vote = (v: number) =>
    requireAuth(async () => {
      const next = await sapi<{ likes: number; dislikes: number; my_vote: number }>(`/episodes/${anime}/${ep}/vote`, { method: "PUT", body: { value: data?.my_vote === v ? 0 : v } })
      qc.setQueryData(["u", "ep-votes", anime, ep], next)
    }, "Sign in to rate episodes.")
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10">
      <button onClick={() => vote(1)} className={cn("flex h-8 items-center gap-1.5 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white", data?.my_vote === 1 && "bg-primary/15 text-primary")}>
        <ThumbsUp className={cn("size-3.5", data?.my_vote === 1 && "fill-current")} />
        {data?.likes ?? 0}
      </button>
      <span className="w-px bg-white/10" />
      <button onClick={() => vote(-1)} className={cn("flex h-8 items-center gap-1.5 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white", data?.my_vote === -1 && "bg-white/10 text-white")}>
        <ThumbsDown className={cn("size-3.5", data?.my_vote === -1 && "fill-current")} />
        {data?.dislikes ?? 0}
      </button>
    </div>
  )
}

type Page = { total: number | null; has_more: boolean; items: Comment[] }

function useThread(anime: number, ep: number, sort: string, parent?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["u", "comments", anime, ep, sort, parent ?? null],
    queryFn: ({ pageParam }) => sapi<Page>(`/comments?anime=${anime}&ep=${ep}&sort=${sort}&limit=20&offset=${pageParam}${parent ? `&parent=${parent}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.has_more ? all.reduce((n, p) => n + p.items.length, 0) : undefined),
    enabled,
  })
}

export function Comments({ anime, ep, currentTime }: { anime: number; ep: number; currentTime?: () => number }) {
  const [sort, setSort] = useState<"top" | "new">("top")
  const q = useThread(anime, ep, sort)
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const total = q.data?.pages[0]?.total ?? 0
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center gap-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="size-5 text-primary" />
          {total} {total === 1 ? "comment" : "comments"}
        </h2>
        <div className="ml-auto flex rounded-lg bg-white/[0.05] p-0.5 text-xs">
          {(["top", "new"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={cn("rounded-md px-3 py-1 font-medium text-white/50 capitalize", sort === s && "bg-white/10 text-white")}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <Composer anime={anime} ep={ep} currentTime={currentTime} />
      <div className="mt-6 space-y-5">
        {q.isLoading && Array.from({ length: 3 }, (_, n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />)}
        {!q.isLoading && !items.length && <p className="py-8 text-center text-sm text-white/40">No comments yet. Start the conversation.</p>}
        {items.map((c) => <CommentItem key={c.id} c={c} anime={anime} ep={ep} />)}
      </div>
      {q.hasNextPage && (
        <button onClick={() => q.fetchNextPage()} className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
          {q.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
          Show more comments
        </button>
      )}
    </section>
  )
}

function Composer({ anime, ep, parent, currentTime, onDone, autoFocus }: { anime: number; ep: number; parent?: string; currentTime?: () => number; onDone?: () => void; autoFocus?: boolean }) {
  const { data: user } = useMe()
  const requireAuth = useRequireAuth()
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const [spoiler, setSpoiler] = useState(false)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Re-render every second so "Live at m:ss" follows the playhead.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!currentTime) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [currentTime])
  const post = () =>
    requireAuth(async () => {
      if (!text.trim()) return
      setBusy(true)
      setError(null)
      try {
        await sapi("/comments", { body: { anime_id: anime, episode: ep, body: text.trim(), parent_id: parent, spoiler, ts: live && currentTime ? currentTime() : undefined } })
        setText("")
        setSpoiler(false)
        qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "comments" || q.queryKey[1] === "live" })
        onDone?.()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
      }
    }, "Sign in to join the discussion.")
  return (
    <div className="flex gap-3">
      {user ? <Avatar name={user.display_name} src={user.avatar} size={parent ? 28 : 36} /> : <span className={cn("shrink-0 rounded-full bg-white/10", parent ? "size-7" : "size-9")} />}
      <div className="min-w-0 flex-1">
        <textarea
          value={text}
          autoFocus={autoFocus}
          onFocus={() => !user && requireAuth(() => {}, "Sign in to join the discussion.")}
          onChange={(e) => setText(e.target.value)}
          placeholder={parent ? "Write a reply…" : "What did you think of this episode?"}
          maxLength={live ? 200 : 2000}
          rows={parent ? 2 : 3}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-primary/50"
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/55">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="accent-primary" /> Spoiler
          </label>
          {!parent && currentTime && (
            <label className="flex cursor-pointer items-center gap-1.5" title="Show this comment over the video at the current moment">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-primary" />
              <Clock className="size-3.5" /> Live at {fmt(currentTime())}
            </label>
          )}
          <div className="ml-auto flex gap-2">
            {onDone && <button onClick={onDone} className="h-8 rounded-lg px-3 font-semibold text-white/60 hover:text-white">Cancel</button>}
            <button onClick={post} disabled={busy || !text.trim()} className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-40">
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {parent ? "Reply" : "Comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentItem({ c, anime, ep, reply }: { c: Comment; anime: number; ep: number; reply?: boolean }) {
  const { data: me } = useMe()
  const requireAuth = useRequireAuth()
  const qc = useQueryClient()
  const [state, setState] = useState({ likes: c.likes, dislikes: c.dislikes, my: c.my_vote })
  const [reveal, setReveal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [reported, setReported] = useState(false)
  const replies = useThread(anime, ep, "new", c.id, showReplies)

  const vote = (v: number) =>
    requireAuth(async () => {
      const r = await sapi<{ likes: number; dislikes: number; my_vote: number }>(`/comments/${c.id}/vote`, { method: "PUT", body: { value: state.my === v ? 0 : v } })
      setState({ likes: r.likes, dislikes: r.dislikes, my: r.my_vote })
    }, "Sign in to vote on comments.")
  const remove = async () => {
    if (!confirm("Delete this comment?")) return
    await sapi(`/comments/${c.id}`, { method: "DELETE" })
    qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "comments" || q.queryKey[1] === "live" })
  }
  const report = () =>
    requireAuth(async () => {
      await sapi(`/comments/${c.id}/report`, { body: { reason: "user report" } })
      setReported(true)
    })

  return (
    <div className="flex gap-3">
      <Avatar name={c.user.display_name} src={c.user.avatar} size={reply ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-white/90">{c.user.display_name}</span>
          {c.user.is_admin && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">ADMIN</span>}
          <span className="text-white/35">{ago(c.created_at)}</span>
          {c.ts !== null && <span className="flex items-center gap-1 rounded bg-brand-blue/15 px-1.5 py-0.5 font-mono text-[10px] text-[#a9b8ff]"><Clock className="size-3" />{fmt(c.ts)}</span>}
        </p>
        {c.deleted ? (
          <p className="mt-1 text-sm text-white/35 italic">Comment deleted</p>
        ) : c.spoiler && !reveal ? (
          <button onClick={() => setReveal(true)} className="mt-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/50 hover:text-white">Spoiler: click to reveal</button>
        ) : (
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line break-words text-white/80">{c.body}</p>
        )}
        {!c.deleted && (
          <div className="mt-2 flex items-center gap-4 text-xs text-white/45">
            <button onClick={() => vote(1)} className={cn("flex items-center gap-1 hover:text-white", state.my === 1 && "text-primary")}><ThumbsUp className={cn("size-3.5", state.my === 1 && "fill-current")} />{state.likes || ""}</button>
            <button onClick={() => vote(-1)} className={cn("flex items-center gap-1 hover:text-white", state.my === -1 && "text-white")}><ThumbsDown className={cn("size-3.5", state.my === -1 && "fill-current")} />{state.dislikes || ""}</button>
            {!reply && <button onClick={() => requireAuth(() => setReplying(true), "Sign in to reply.")} className="font-semibold hover:text-white">Reply</button>}
            {me && me.id !== c.user.id && <button onClick={report} disabled={reported} className="flex items-center gap-1 hover:text-white">{reported ? "Reported" : <><Flag className="size-3" />Report</>}</button>}
            {me && (me.id === c.user.id || me.is_admin) && <button onClick={remove} className="flex items-center gap-1 hover:text-red-400"><Trash2 className="size-3" />Delete</button>}
          </div>
        )}
        {replying && (
          <div className="mt-3">
            <Composer anime={anime} ep={ep} parent={c.id} autoFocus onDone={() => { setReplying(false); setShowReplies(true) }} />
          </div>
        )}
        {!reply && c.reply_count > 0 && (
          <button onClick={() => setShowReplies(!showReplies)} className="mt-2 text-xs font-semibold text-primary">
            {showReplies ? "Hide replies" : `View ${c.reply_count} ${c.reply_count === 1 ? "reply" : "replies"}`}
          </button>
        )}
        {showReplies && (
          <div className="mt-3 space-y-4">
            {replies.data?.pages.flatMap((p) => p.items).map((r) => <CommentItem key={r.id} c={r} anime={anime} ep={ep} reply />)}
            {replies.hasNextPage && <button onClick={() => replies.fetchNextPage()} className="text-xs font-semibold text-primary">More replies</button>}
          </div>
        )}
      </div>
    </div>
  )
}
