// Account pages: settings (/settings), password reset (/reset?t=) and the privacy policy (/privacy).
import { useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Container } from "@/components/Section"
import { useAuthDialog } from "@/components/social/AuthDialog"
import { SITE_NAME, useHead } from "@/lib/seo"
import { sapi, useMe, useProviders, type User } from "@/lib/social"

const input = "h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm outline-none focus:border-primary/60"
const primary = "flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/85 disabled:opacity-50"

/** Runs an async action with busy/message state for a settings card. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMsg(null)
    try {
      const ok = await fn()
      if (ok) setMsg({ ok: true, text: ok })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return { busy, msg, run }
}

function Card({ title, desc, children, msg }: { title: string; desc?: string; children: ReactNode; msg?: { ok: boolean; text: string } | null }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
      <h2 className="font-bold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-white/50">{desc}</p>}
      <div className="mt-4">{children}</div>
      {msg && <p className={msg.ok ? "mt-3 text-sm text-emerald-300" : "mt-3 text-sm text-red-400"}>{msg.text}</p>}
    </section>
  )
}

export function Settings() {
  useHead({ title: `Settings | ${SITE_NAME}`, noindex: true })
  const { data: me, isLoading } = useMe()
  const { open } = useAuthDialog()
  if (isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!me)
    return (
      <Container className="pt-32 text-center">
        <p className="text-white/60">Sign in to manage your account.</p>
        <button onClick={() => open()} className={`${primary} mx-auto mt-4`}>Sign in</button>
      </Container>
    )
  return <SettingsForm me={me} />
}

function SettingsForm({ me }: { me: User }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const providers = useProviders()
  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] })
  const [name, setName] = useState(me.display_name)
  const [email, setEmail] = useState(me.email ?? "")
  const [pw, setPw] = useState({ current: "", next: "" })
  const profile = useAction()
  const emailAct = useAction()
  const pwAct = useAction()
  const pushAct = useAction()
  const del = useAction()

  const enablePush = () =>
    pushAct.run(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser doesn't support push notifications")
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site in your browser settings")
      const reg = await navigator.serviceWorker.register("/sw.js")
      const { key } = await sapi<{ key: string }>("/push/key")
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw }))
      await sapi("/push/subscribe", { body: { endpoint: sub.endpoint } })
      return "Push notifications are on for this browser."
    })

  return (
    <Container className="max-w-2xl pt-24">
      <h1 className="text-3xl font-black tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-white/45">Signed in as @{me.username}</p>
      <div className="mt-8 space-y-5">
        <Card title="Profile" msg={profile.msg}>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} aria-label="Display name" />
            <button disabled={profile.busy} onClick={() => profile.run(async () => { await sapi("/me", { method: "PATCH", body: { display_name: name } }); refresh(); return "Saved." })} className={primary}>Save</button>
          </div>
        </Card>

        {providers.data?.email && (
          <Card title="Email" desc="Used for sign-in links, password resets and new-episode emails. Never shown publicly." msg={sp.get("email") === "verified" && !emailAct.msg ? { ok: true, text: "Email confirmed." } : emailAct.msg}>
            <div className="flex gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} aria-label="Email" />
              <button disabled={emailAct.busy || !email || email === me.email} onClick={() => emailAct.run(async () => { await sapi("/me/email", { body: { email } }); return `We sent a confirmation link to ${email}.` })} className={primary}>{me.email ? "Change" : "Add"}</button>
            </div>
            {me.email && (
              <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" defaultChecked={me.email_notify} onChange={(e) => void sapi("/me", { method: "PATCH", body: { email_notify: e.target.checked } }).then(refresh)} className="accent-primary" />
                Email me when a subscribed anime gets a new episode
              </label>
            )}
          </Card>
        )}

        <Card title="Browser notifications" desc="Get a notification on this device when a subscribed anime airs or someone replies to you." msg={pushAct.msg}>
          <button disabled={pushAct.busy} onClick={enablePush} className={primary}>{pushAct.busy && <Loader2 className="size-4 animate-spin" />}Turn on for this browser</button>
        </Card>

        <Card title={me.has_password ? "Change password" : "Set a password"} desc={me.has_password ? "Changing it signs you out on other devices." : "Add a password so you can also sign in with your username."} msg={pwAct.msg}>
          <div className="space-y-2">
            {me.has_password && <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Current password" autoComplete="current-password" className={input} />}
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="New password (8+ characters)" autoComplete="new-password" className={input} />
            <button disabled={pwAct.busy || pw.next.length < 8} onClick={() => pwAct.run(async () => { await sapi("/me/password", { body: { current: pw.current, password: pw.next } }); setPw({ current: "", next: "" }); refresh(); return "Password updated." })} className={primary}>Update password</button>
          </div>
        </Card>

        <Card title="Delete account" desc="Permanently deletes your account, comments, playlists, history and subscriptions. This can't be undone." msg={del.msg}>
          <button
            disabled={del.busy}
            onClick={() => confirm("Delete your account and everything in it? This can't be undone.") && del.run(async () => { await sapi("/me", { method: "DELETE" }); qc.setQueryData(["me"], null); navigate("/") })}
            className="h-10 rounded-xl border border-red-500/40 px-5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete my account
          </button>
        </Card>
      </div>
    </Container>
  )
}

export function ResetPassword() {
  useHead({ title: `Reset password | ${SITE_NAME}`, noindex: true })
  const [sp] = useSearchParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [pw, setPw] = useState("")
  const act = useAction()
  return (
    <Container className="max-w-md pt-32">
      <h1 className="text-2xl font-black">Choose a new password</h1>
      <div className="mt-6 space-y-3">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className={input} />
        <button
          disabled={act.busy || pw.length < 8}
          onClick={() => act.run(async () => { const d = await sapi<{ user: User }>("/auth/reset", { body: { token: sp.get("t"), password: pw } }); qc.setQueryData(["me"], d.user); navigate("/") })}
          className={`${primary} w-full`}
        >
          Set password and sign in
        </button>
        {act.msg && <p className="text-sm text-red-400">{act.msg.text}</p>}
      </div>
    </Container>
  )
}

export function Privacy() {
  useHead({ title: `Privacy Policy | ${SITE_NAME}`, description: "What AnimeGang collects, why, and how to delete it.", path: "/privacy" })
  const h = "mt-8 text-lg font-bold text-white"
  return (
    <Container className="max-w-3xl pt-24 text-[15px] leading-relaxed text-white/65">
      <h1 className="text-3xl font-black tracking-tight text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-white/40">Last updated October 2026</p>
      <h2 className={h}>What we collect</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Without an account:</b> watch history, resume points and player settings are stored only in your browser (localStorage).</li>
        <li><b>With an account:</b> your username, display name, a salted password hash (never the password), and optionally an email address you confirm. If you sign in with Google or Discord we store their account ID, name and avatar.</li>
        <li><b>What you do:</b> synced history, playlists, subscriptions, likes, comments and watch-party chat (the last 150 messages per room).</li>
        <li><b>Push notifications:</b> if you turn them on, the push address your browser gives us.</li>
        <li><b>Security:</b> your IP address is used briefly to rate-limit sign-in attempts and is not stored with your account.</li>
      </ul>
      <h2 className={h}>Cookies and analytics</h2>
      <p className="mt-2">We use one essential cookie to keep you signed in. Google Analytics measures visits only if you accept analytics cookies in the banner. Ads are served by Adsterra in isolated frames; Adsterra may set its own cookies, governed by its privacy policy.</p>
      <h2 className={h}>Video and data sources</h2>
      <p className="mt-2">Anime information comes from AniList and ani.zip. Videos are streamed from third-party hosts; we don't store video files. Those services see your IP address when your browser loads from them.</p>
      <h2 className={h}>Your choices</h2>
      <p className="mt-2">You can change your email, notification settings or password, and permanently delete your account and everything linked to it, in <Link to="/settings" className="text-primary hover:underline">Settings</Link>. You can clear browser-only data by clearing this site's storage.</p>
      <h2 className={h}>Contact</h2>
      <p className="mt-2">Questions or removal requests: <a href="mailto:support@animegng.com" className="text-primary hover:underline">support@animegng.com</a></p>
    </Container>
  )
}
