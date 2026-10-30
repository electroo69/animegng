import { lazy, Suspense, useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { UserMenu } from "@/components/social/UserMenu"
import { LiveCount } from "@/components/LiveCount"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { BookOpen, CalendarDays, Library, Clock, Compass, Flame, Home, Menu, Search, Sparkles, Trophy, Tv } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// The search dialog (cmdk + dialog) loads on first open, not with the page.
const SearchCommand = lazy(() => import("@/components/SearchCommand").then((m) => ({ default: m.SearchCommand })))

export const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/browse/trending", label: "Trending", icon: Flame },
  { to: "/browse/seasonal", label: "This Season", icon: Sparkles },
  { to: "/browse/top", label: "Top Rated", icon: Trophy },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/search", label: "Browse", icon: Compass },
]

// MangaGang (/manga) has its own logo and menu.
export const MANGA_NAV = [
  { to: "/manga", label: "Home", icon: Home },
  { to: "/manga/browse?sort=popular", label: "Popular", icon: Flame },
  { to: "/manga/browse?sort=latest", label: "Latest Updates", icon: Clock },
  { to: "/manga/browse?sort=az", label: "A–Z", icon: Compass },
  { to: "/manga/library", label: "Library", icon: Library },
]

export const useIsManga = () => useLocation().pathname.startsWith("/manga")

// Anime ⇄ Manga switch. Navigates inside a view transition (index.css): the site below the navbar slides
// sideways to the other section. The target page's code is loaded first, so the new view fades in already rendered.
const PAGES = { "/": () => import("@/pages/Home"), "/manga": () => import("@/pages/manga/MangaHome") }

function SectionSwitch() {
  const manga = useIsManga()
  const navigate = useNavigate()
  const go = (to: keyof typeof PAGES) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (!document.startViewTransition) return navigate(to)
    // Direction for the slide (index.css): to manga the site pans left, back to anime it pans right.
    const root = document.documentElement
    root.dataset.vt = to === "/manga" ? "manga" : "anime"
    const t = document.startViewTransition(async () => {
      await PAGES[to]().catch(() => {})
      window.scrollTo(0, 0)
      flushSync(() => navigate(to))
    })
    // A skipped transition (hidden tab, rapid double-click) still navigates; only the animation is dropped.
    t.ready.catch(() => {})
    t.finished.finally(() => delete root.dataset.vt)
  }
  const item = "relative z-10 flex h-full items-center gap-1.5 rounded-full px-2.5 transition-colors duration-300 sm:px-3.5"
  return (
    <div role="group" aria-label="Switch between anime and manga" className="relative flex h-9 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[12.5px] font-semibold">
      <span
        aria-hidden
        className={cn("absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", manga && "translate-x-full")}
      />
      <Link to="/" onClick={go("/")} aria-current={manga ? undefined : "page"} aria-label="Anime" className={cn(item, manga ? "text-white/60 hover:text-white" : "text-primary-foreground")}>
        <Tv className="size-3.5" />
        <span className="hidden sm:inline">Anime</span>
      </Link>
      <Link to="/manga" onClick={go("/manga")} onPointerEnter={PAGES["/manga"]} aria-current={manga ? "page" : undefined} aria-label="Manga" className={cn(item, manga ? "text-primary-foreground" : "text-white/60 hover:text-white")}>
        <BookOpen className="size-3.5" />
        <span className="hidden sm:inline">Manga</span>
      </Link>
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  const manga = useIsManga()
  return manga ? (
    <Link to="/manga" aria-label="MangaGang home" className={cn("block shrink-0", className)}>
      <img src="/mangagang-logo.webp" alt="MangaGang" width={444} height={96} className="h-full w-auto select-none" draggable={false} />
    </Link>
  ) : (
    <Link to="/" aria-label="AnimeGang home" className={cn("block shrink-0", className)}>
      <img src="/logo-nav.webp" alt="AnimeGang" width={451} height={96} className="h-full w-auto select-none" draggable={false} />
    </Link>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchUsed, setSearchUsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const manga = useIsManga()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const links = manga ? MANGA_NAV : NAV
  // NavLink ignores the query string; manga links differ only by ?sort=, so match it here.
  const active = (to: string) => (to.includes("?") ? pathname + search === to : to === "/" || to === "/manga" ? pathname === to : pathname.startsWith(to))
  const openSearch = () => (manga ? navigate("/manga/browse") : setSearchOpen(true))

  if (searchOpen && !searchUsed) setSearchUsed(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault()
        if (location.pathname.startsWith("/manga")) navigate("/manga/browse")
        else setSearchOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])

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
          "site-header fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled ? "glass border-b border-white/[0.06] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]" : "bg-gradient-to-b from-black/70 to-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-10">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-white/10 bg-background/95 p-5 backdrop-blur-xl">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo className="h-8" />
              <nav className="mt-6 flex flex-col gap-1">
                {links.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white",
                      active(to) && "bg-primary/10 text-white [&_svg]:text-primary",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <LiveCount className="mt-4 flex px-3" />
            </SheetContent>
          </Sheet>

          <Logo className="h-5 min-[360px]:h-6 sm:h-8" />
          <SectionSwitch />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {links.slice(1).map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/65 transition-colors hover:text-white",
                  active(to) && "text-white after:absolute after:inset-x-3.5 after:-bottom-[3px] after:h-[2px] after:rounded-full after:bg-gradient-to-r after:from-brand-red after:to-brand-blue",
                )}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={openSearch}
            aria-label={manga ? "Search manga" : "Search anime"}
            className="group ml-auto grid size-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/5 hover:text-white md:flex md:h-10 md:w-64 md:items-center md:gap-2.5 md:border md:border-white/10 md:bg-white/[0.04] md:pr-2 md:pl-3.5 md:text-sm md:text-white/50 md:hover:border-white/20 md:hover:bg-white/[0.07] md:hover:text-white/80 lg:w-72"
          >
            <Search className="size-5 md:size-4" />
            <span className="hidden whitespace-nowrap md:inline">{manga ? "Search manga…" : "Search anime…"}</span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50 md:flex">
              Ctrl K
            </kbd>
          </button>
          <LiveCount className="hidden xl:flex" />
          <UserMenu />
        </div>
      </header>
      {searchUsed && (
        <Suspense fallback={null}>
          <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      )}
    </>
  )
}
