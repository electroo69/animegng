import { lazy, Suspense, useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { ScrollProgress } from "@/components/ui/scroll-progress"
import Home from "@/pages/Home"
import NotFound from "@/pages/NotFound"

// Route-level code splitting: the home page ships in the main bundle, the rest load on demand.
const AnimeDetail = lazy(() => import("@/pages/AnimeDetail"))
const Watch = lazy(() => import("@/pages/Watch"))
const Search = lazy(() => import("@/pages/Search"))
const Schedule = lazy(() => import("@/pages/Schedule"))
const Browse = lazy(() => import("@/pages/Browse"))
const GenrePage = lazy(() => import("@/pages/Collection").then((m) => ({ default: m.GenrePage })))
const SeasonPage = lazy(() => import("@/pages/Collection").then((m) => ({ default: m.SeasonPage })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="grain relative flex min-h-dvh flex-col overflow-x-clip">
      <ScrollToTop />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
