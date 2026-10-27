import { useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { ScrollProgress } from "@/components/ui/scroll-progress"
import Home from "@/pages/Home"
import AnimeDetail from "@/pages/AnimeDetail"
import Watch from "@/pages/Watch"
import Search from "@/pages/Search"
import Schedule from "@/pages/Schedule"
import Browse from "@/pages/Browse"
import NotFound from "@/pages/NotFound"

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/watch/:id/:ep?" element={<Watch />} />
          <Route path="/search" element={<Search />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/browse/:kind" element={<Browse />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
