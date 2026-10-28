// Sign-in / sign-up dialog, opened from anywhere via useAuthDialog().open(reason).
import { createContext, useContext, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { sapi, useAuthActions, useMe, useProviders } from "@/lib/social"
import { cn } from "@/lib/utils"

const Ctx = createContext<{ open: (reason?: string) => void }>({ open: () => {} })
export const useAuthDialog = () => useContext(Ctx)

/** Run `fn` if signed in, otherwise ask the visitor to sign in first. */
export function useRequireAuth() {
  const { data: user } = useMe()
  const { open } = useAuthDialog()
  return (fn: () => void, reason?: string) => (user ? fn() : open(reason))
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; reason?: string }>({ open: false })
  return (
    <Ctx.Provider value={{ open: (reason) => setState({ open: true, reason }) }}>
      {children}
      <AuthDialog open={state.open} reason={state.reason} onOpenChange={(open) => setState((s) => ({ ...s, open }))} />
    </Ctx.Provider>
  )
}

function AuthDialog({ open, reason, onOpenChange }: { open: boolean; reason?: string; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "magic">("login")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [password, setPassword] = useState("")
  const { login, register } = useAuthActions()
  const providers = useProviders()
  const action = mode === "register" ? register : login
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    try {
      await sapi(mode === "forgot" ? "/auth/forgot" : "/auth/magic", { body: { email: email.trim() } })
      setSent(`If an account uses ${email.trim()}, we've emailed it a link.`)
    } catch (err) {
      setEmailError((err as Error).message)
    }
  }
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    action.mutate(
      { username: username.trim(), password, ...(mode === "register" ? { email: regEmail.trim() } : {}) },
      {
        onSuccess: () => {
          setPassword("")
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-popover/95 p-6 backdrop-blur-xl sm:max-w-sm" showCloseButton>
        <DialogTitle className="text-xl font-bold">{{ login: "Welcome back", register: "Create your account", forgot: "Reset your password", magic: "Sign in with email" }[mode]}</DialogTitle>
        <DialogDescription className="text-sm text-white/50">
          {reason ?? "Sync your history across devices, make playlists, comment and host watch parties."}
        </DialogDescription>

        {(providers.data?.google || providers.data?.discord) && (
          <div className="mt-2 grid gap-2">
            {providers.data.google && (
              <a href={`/api/u/auth/google?next=${encodeURIComponent(next)}`} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white text-sm font-semibold text-black transition hover:bg-white/90">
                Continue with Google
              </a>
            )}
            {providers.data.discord && (
              <a href={`/api/u/auth/discord?next=${encodeURIComponent(next)}`} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5865F2] text-sm font-semibold text-white transition hover:bg-[#4752c4]">
                Continue with Discord
              </a>
            )}
            <p className="my-1 text-center text-xs text-white/30">or</p>
          </div>
        )}

        {(mode === "forgot" || mode === "magic") && (
          <form onSubmit={sendLink} className="mt-2 space-y-3">
            {sent ? (
              <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">{sent}</p>
            ) : (
              <>
                <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your account email" className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60" />
                {emailError && <p className="text-sm text-red-400">{emailError}</p>}
                <button disabled={!email} className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50">{mode === "forgot" ? "Email me a reset link" : "Email me a sign-in link"}</button>
              </>
            )}
            <button type="button" onClick={() => { setMode("login"); setSent(null) }} className="w-full text-center text-sm font-semibold text-primary hover:underline">Back to sign in</button>
          </form>
        )}
        {(mode === "login" || mode === "register") && (<>
        <form onSubmit={submit} className="mt-2 space-y-3">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={mode === "login" ? "Username or email" : "Username"}
            autoComplete="username"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60"
          />
          {mode === "register" && (
            <input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60"
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60"
          />
          {action.error && <p className="text-sm text-red-400">{action.error.message}</p>}
          <button disabled={action.isPending || !username || !password || (mode === "register" && !regEmail)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary/85 disabled:opacity-50">
            {action.isPending && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "login" && providers.data?.email && (
            <div className="flex justify-between text-xs font-semibold text-white/50">
              <button type="button" onClick={() => setMode("forgot")} className="hover:text-white">Forgot password?</button>
              <button type="button" onClick={() => setMode("magic")} className="hover:text-white">Email me a sign-in link</button>
            </div>
          )}
        </form>
        <p className="mt-1 text-center text-sm text-white/50">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login")
              login.reset()
              register.reset()
            }}
            className={cn("font-semibold text-primary hover:underline")}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
        </>)}
      </DialogContent>
    </Dialog>
  )
}
