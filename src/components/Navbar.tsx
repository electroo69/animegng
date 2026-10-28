import { useEffect, useState } from "react"
import { UserMenu } from "@/components/social/UserMenu"
import { Link, NavLink } from "react-router-dom"
import { CalendarDays, Compass, Flame, Home, Menu, Search, Sparkles, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { SearchCommand } from "@/components/SearchCommand"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/browse/trending", label: "Trending", icon: Flame },
  { to: "/browse/seasonal", label: "This Season", icon: Sparkles },
  { to: "/browse/top", label: "Top Rated", icon: Trophy },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/search", label: "Browse", icon: Compass },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="AnimeGang home" className={cn("block shrink-0", className)}>
      <img src="/logo.png" alt="AnimeGang" className="h-full w-auto select-none" draggable={false} />
    </Link>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled ? "glass border-b border-white/[0.06] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]" : "bg-gradient-to-b from-black/70 to-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger className="-ml-1 grid size-9 place-items-center rounded-lg text-white/80 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-white/10 bg-background/95 p-5 backdrop-blur-xl">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo className="h-8" />
              <nav className="mt-6 flex flex-col gap-1">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white",
                        isActive && "bg-primary/10 text-white [&_svg]:text-primary",
                      )
                    }
                  >
                    <Icon className="size-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Logo className="h-7 sm:h-8" />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.slice(1).map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/65 transition-colors hover:text-white",
                    isActive && "text-white after:absolute after:inset-x-3.5 after:-bottom-[3px] after:h-[2px] after:rounded-full after:bg-gradient-to-r after:from-brand-red after:to-brand-blue",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setSearchOpen(true)}
            className="group ml-auto flex h-10 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] pr-2 pl-3.5 text-sm text-white/50 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80 sm:w-72"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search anime…</span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50 sm:flex">
              Ctrl K
            </kbd>
          </button>
          <UserMenu />
        </div>
      </header>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
