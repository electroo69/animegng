import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthDialogProvider } from "@/components/social/AuthDialog"
import "./index.css"
import App from "./App"
import { prerenderHeroImg } from "@/lib/prerender"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// After a deploy, a tab opened earlier can ask for page code that no longer exists. Reload once to pick up
// the new build instead of showing a broken page (the flag stops a reload loop if something else is wrong).
addEventListener("vite:preloadError", (e) => {
  try {
    if (sessionStorage.getItem("ag:reloaded")) return
    sessionStorage.setItem("ag:reloaded", "1")
  } catch {
    return
  }
  e.preventDefault()
  location.reload()
})
addEventListener("load", () => setTimeout(() => {
  try {
    sessionStorage.removeItem("ag:reloaded")
  } catch {
    // ignore
  }
}, 10_000))

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider>
            <AuthDialogProvider>
              <App />
            </AuthDialogProvider>
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// Pages served through the edge arrive pre-rendered (worker/seo.js). Let that HTML paint first, so first paint
// doesn't wait on the app's JavaScript or anything the app requests. On the home page, wait until the browser
// has recorded the pre-rendered hero image as the largest paint; the app's hero then reuses that same <img>
// element (HeroSpotlight), so the page's largest paint stays at that early point.
const prerender = document.getElementById("prerender")
const afterPaint = () => requestAnimationFrame(() => setTimeout(mount))
// A tab loaded in the background never records a largest paint, so there's nothing to wait for.
if (document.visibilityState === "hidden") mount()
else if (prerenderHeroImg && "PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")) {
  let started = false
  const go = () => {
    if (started) return
    started = true
    observer.disconnect()
    setTimeout(mount)
  }
  const observer = new PerformanceObserver((list) => {
    if (list.getEntries().some((e) => (e as PerformanceEntry & { element?: Element }).element === prerenderHeroImg)) go()
  })
  observer.observe({ type: "largest-contentful-paint", buffered: true })
  setTimeout(go, 3000)
} else if (prerender) afterPaint()
else mount()
