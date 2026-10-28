import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function SectionHeader({ title, eyebrow, href, action, className }: { title: ReactNode; eyebrow?: string; href?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="mb-1.5 font-mono text-[10.5px] font-medium tracking-[0.25em] text-primary uppercase">{eyebrow}</p>}
        <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
          <span className="slash-clip h-5 w-1.5 bg-gradient-to-b from-brand-red to-brand-blue" />
          {title}
        </h2>
      </div>
      {action}
      {href && (
        <Link to={href} className="group flex shrink-0 items-center gap-1 text-[13px] font-medium text-white/50 transition hover:text-white">
          View all
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

// Fades in as it scrolls into view via a CSS view timeline (index.css .reveal), so there's no JS observer per section.
export function Section({ children, className }: { children: ReactNode; className?: string; delay?: number }) {
  return <section className={cn("reveal", className)}>{children}</section>
}

// Horizontally scrolling rail with arrow buttons; children should be fixed-width items.
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" })
  return (
    <div className="group/rail relative">
      <div ref={ref} className={cn("no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-0 lg:px-0", className)}>
        {children}
      </div>
      {[-1, 1].map((d) => (
        <button
          key={d}
          onClick={() => scroll(d as 1 | -1)}
          aria-label={d < 0 ? "Scroll left" : "Scroll right"}
          className={cn(
            "absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 backdrop-blur-md transition hover:border-primary/60 hover:bg-primary/80 group-hover/rail:opacity-100 lg:grid",
            d < 0 ? "-left-5" : "-right-5",
          )}
        >
          {d < 0 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
      ))}
    </div>
  )
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10", className)}>{children}</div>
}

// Renders children only once they're near the viewport, so heavy below-the-fold widgets
// (WebGL backgrounds, animated counters) don't cost anything during the first load.
export function WhenVisible({ children, minHeight = 200 }: { children: ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: "400px" })
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  return <div ref={ref} style={show ? undefined : { minHeight }}>{show && children}</div>
}
