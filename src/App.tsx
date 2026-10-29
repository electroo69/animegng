import { lazy, Suspense, useEffect, useRef } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { ConsentBanner } from "@/components/social/ConsentBanner"
import { ScrollProgress } from "@/components/ui/scroll-progress"
import Home from "@/pages/Home"

// Route-level code splitting: the home page ships in the main bundle, the rest load on demand.
const NotFound = lazy(() => import("@/pages/NotFound"))
const AnimeDetail = lazy(() => import("@/pages/AnimeDetail"))
const Watch = lazy(() => import("@/pages/Watch"))
const Search = lazy(() => import("@/pages/Search"))
const Schedule = lazy(() => import("@/pages/Schedule"))
const Browse = lazy(() => import("@/pages/Browse"))
const GenrePage = lazy(() => import("@/pages/Collection").then((m) => ({ default: m.GenrePage })))
const SeasonPage = lazy(() => import("@/pages/Collection").then((m) => ({ default: m.SeasonPage })))
const Library = lazy(() => import("@/pages/Library"))
const Party = lazy(() => import("@/pages/Party"))
const Settings = lazy(() => import("@/pages/Account").then((m) => ({ default: m.Settings })))
const ResetPassword = lazy(() => import("@/pages/Account").then((m) => ({ default: m.ResetPassword })))
const MangaHome = lazy(() => import("@/pages/manga/MangaHome"))
const MangaBrowse = lazy(() => import("@/pages/manga/MangaBrowse"))
const MangaDetail = lazy(() => import("@/pages/manga/MangaDetail"))
const MangaReader = lazy(() => import("@/pages/manga/MangaReader"))
const Privacy = lazy(() => import("@/pages/Account").then((m) => ({ default: m.Privacy })))

function ScrollToTop() {
  const { pathname } = useLocation()
  // Only on in-app navigation: a fresh page load already starts at the top, and scrolling then forces a layout.
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

// MangaGang (/manga) swaps the red accent for green. Set on <html> so dialogs and sheets portaled to <body> follow.
function MangaTheme() {
  const manga = useLocation().pathname.startsWith("/manga")
  useEffect(() => {
    document.documentElement.classList.toggle("theme-manga", manga)
  }, [manga])
  return null
}

export default function App() {
  return (
    <div className="grain relative flex min-h-dvh flex-col overflow-x-clip">
      <ScrollToTop />
      <MangaTheme />
      <ScrollProgress className="top-0 z-[60] h-[2px] bg-gradient-to-r from-brand-red via-brand-red to-brand-blue" />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[80vh]" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/anime/:id/:slug?" element={<AnimeDetail />} />
            <Route path="/watch/:id/:ep?" element={<Watch />} />
            <Route path="/search" element={<Search />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/browse/:kind" element={<Browse />} />
            <Route path="/genre/:slug" element={<GenrePage />} />
            <Route path="/season/:year/:season" element={<SeasonPage />} />
            <Route path="/library" element={<Library />} />
            <Route path="/party/:id" element={<Party />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/manga" element={<MangaHome />} />
            <Route path="/manga/browse" element={<MangaBrowse />} />
            <Route path="/manga/read/:sid/:cid" element={<MangaReader />} />
            <Route path="/manga/:id/:slug?" element={<MangaDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  )
}
