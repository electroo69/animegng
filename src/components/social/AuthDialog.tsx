// Sign-in / sign-up dialog, opened from anywhere via useAuthDialog().open(reason).
import { createContext, useContext, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useAuthActions, useMe, useProviders } from "@/lib/social"
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
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { login, register } = useAuthActions()
  const providers = useProviders()
  const action = mode === "login" ? login : register
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    action.mutate(
      { username: username.trim(), password },
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
        <DialogTitle className="text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</DialogTitle>
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

        <form onSubmit={submit} className="mt-2 space-y-3">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-primary/60"
          />
          {action.error && <p className="text-sm text-red-400">{action.error.message}</p>}
          <button disabled={action.isPending || !username || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary/85 disabled:opacity-50">
            {action.isPending && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
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
      </DialogContent>
    </Dialog>
  )
}
