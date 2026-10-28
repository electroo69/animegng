// Navbar account area: sign-in button, or notifications bell + avatar menu.
import { Link, useNavigate } from "react-router-dom"
import { Bell, Library, LogOut, MessageSquare, Settings, Tv } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuthDialog } from "@/components/social/AuthDialog"
import { Avatar, Dropdown, ago } from "@/components/social/ui"
import { titleOf } from "@/lib/format"
import { sapi, useAuthActions, useHistorySync, useMe, useNotifications } from "@/lib/social"
import { cn } from "@/lib/utils"

export function UserMenu() {
  const { data: user, isLoading } = useMe()
  const { open } = useAuthDialog()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  useHistorySync()

  if (isLoading) return <span className="size-9" />
  if (!user)
    return (
      <button onClick={() => open()} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90">
        Sign in
      </button>
    )

  return (
    <div className="flex shrink-0 items-center gap-1">
      <NotificationsBell />
      <Dropdown
        className="w-56 p-1.5"
        trigger={() => (
          <button aria-label="Account menu" className="rounded-full p-0.5 ring-1 ring-white/10 transition hover:ring-white/30">
            <Avatar name={user.display_name} src={user.avatar} size={34} />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{user.display_name}</p>
              <p className="truncate text-xs text-white/40">@{user.username}</p>
            </div>
            <div className="my-1 h-px bg-white/10" />
            <MenuLink to="/library" icon={Library} onClick={close}>Library</MenuLink>
            <MenuLink to="/library?tab=subscriptions" icon={Bell} onClick={close}>Subscriptions</MenuLink>
            <MenuLink to="/settings" icon={Settings} onClick={close}>Settings</MenuLink>
            <button
              onClick={() => {
                close()
                logout.mutate(undefined, { onSuccess: () => navigate("/") })
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </>
        )}
      </Dropdown>
    </div>
  )
}

function MenuLink({ to, icon: Icon, onClick, children }: { to: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
      <Icon className="size-4" />
      {children}
    </Link>
  )
}

function NotificationsBell() {
  const { data } = useNotifications(true)
  const qc = useQueryClient()
  const markRead = () => {
    if (!data?.unread) return
    void sapi("/notifications/read", { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["u", "notifications"] }))
  }
  return (
    <Dropdown
      className="w-80 overflow-hidden"
      trigger={(open) => (
        <button
          aria-label="Notifications"
          onClick={() => !open && markRead()}
          className="relative grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <Bell className="size-5" />
          {!!data?.unread && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Notifications</p>
          <div className="max-h-96 overflow-y-auto">
            {!data?.items.length && <p className="px-4 py-8 text-center text-sm text-white/40">Nothing yet. Subscribe to an anime to hear about new episodes.</p>}
            {data?.items.map((n) => (
              <Link
                key={n.id}
                to={`/watch/${n.payload.anime_id}/${n.payload.episode}`}
                onClick={close}
                className={cn("flex gap-3 px-4 py-3 transition hover:bg-white/5", !n.read && "bg-primary/[0.06]")}
              >
                {n.type === "episode" ? (
                  n.payload.cover ? <img src={n.payload.cover} alt="" className="h-12 w-9 shrink-0 rounded object-cover" /> : <Tv className="mt-1 size-5 shrink-0 text-primary" />
                ) : (
                  <MessageSquare className="mt-1 size-5 shrink-0 text-brand-blue" />
                )}
                <div className="min-w-0 text-sm">
                  {n.type === "episode" ? (
                    <p className="text-white/85">
                      <span className="font-semibold">Episode {n.payload.episode}</span> of {n.payload.title ? titleOf(n.payload.title) : "a show you follow"} is out
                    </p>
                  ) : (
                    <p className="text-white/85">
                      <span className="font-semibold">{n.payload.from}</span> replied: <span className="text-white/55">{n.payload.excerpt}</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-white/35">{ago(n.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Dropdown>
  )
}
