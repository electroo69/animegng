import { useEffect, useState } from "react"
import { animeHref } from "@/lib/seo"
import { WatchLink } from "@/components/WatchLink"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"
import { Calendar, ChevronLeft, ChevronRight, Clapperboard, Info, Play, Star } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text"
import { Particles } from "@/components/ui/particles"
import { api, useAnime, type AnimeCard, type AnimeDetail } from "@/lib/api"
import { availableEpisodes, formatLabel, score, statusLabel, stripHtml, titleOf } from "@/lib/format"
import { cn } from "@/lib/utils"

const INTERVAL = 9000

const art = (d: AnimeDetail | undefined, type: string) => d?.artwork?.find((a) => a.coverType === type)?.url

export function HeroSpotlight({ items }: { items: AnimeCard[] }) {
  const slides = items.filter((a) => a.banner_image).slice(0, 8)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const qc = useQueryClient()
  const cur = slides[i]
  const { data: detail } = useAnime(cur?.id)

  useEffect(() => {
    if (paused || slides.length < 2) return
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), INTERVAL)
    return () => clearTimeout(t)
  }, [i, paused, slides.length])

  // Warm the next slide's details so its logo and synopsis are ready on transition.
  useEffect(() => {
    const next = slides[(i + 1) % slides.length]
    if (next) qc.prefetchQuery({ queryKey: ["anime", next.id], queryFn: () => api<AnimeDetail>(`/anime/${next.id}`), staleTime: 30 * 60_000 })
  }, [i, slides, qc])

  if (!cur) return <div className="h-[78vh] min-h-[560px] animate-pulse bg-white/[0.03]" />

  const bg = cur.banner_image!
  const logo = detail?.id === cur.id ? art(detail, "Clearlogo") : undefined
  const desc = detail?.id === cur.id ? stripHtml(detail.description) : ""
  const eps = availableEpisodes(cur)
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length)

  return (
    <section
      className="relative h-[82vh] max-h-[860px] min-h-[580px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={cur.id + bg}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1 }, scale: { duration: INTERVAL / 1000 + 1, ease: "linear" } }}
          className="absolute inset-0"
        >
          <img src={bg} alt="" fetchPriority={i === 0 ? "high" : "auto"} decoding="async" className="size-full object-cover object-[center_25%]" />
        </motion.div>
      </AnimatePresence>

      {/* Cinematic grading */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/0 md:via-background/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-background/50" />
      <div className="absolute -bottom-40 -left-40 size-[36rem] rounded-full bg-brand-red/20 blur-[140px]" />
      <div className="absolute -right-32 -bottom-52 size-[30rem] rounded-full bg-brand-blue/20 blur-[140px]" />
      <Particles className="absolute inset-0 hidden md:block" quantity={30} ease={70} size={0.5} color="#ffffff" refresh={false} />

      <div className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pb-28 sm:px-6 lg:px-10 lg:pb-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 backdrop-blur-md">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              <AnimatedShinyText className="mx-0 text-xs font-medium tracking-wide text-white/70">#{i + 1} Spotlight · Trending now</AnimatedShinyText>
            </div>

            {logo ? (
              <img src={logo} alt={titleOf(cur.title)} className="mb-5 max-h-36 max-w-[min(85vw,480px)] object-contain object-left drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]" />
            ) : (
              <h1 className="mb-5 line-clamp-2 text-4xl leading-[1.05] font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{titleOf(cur.title)}</h1>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] font-medium text-white/80">
              {score(cur.average_score) && (
                <span className="flex items-center gap-1 rounded-md bg-amber-400/15 px-2 py-0.5 text-amber-300">
                  <Star className="size-3.5 fill-current" />
                  {score(cur.average_score)}
                </span>
              )}
              {cur.format && <Chip icon={Clapperboard}>{formatLabel(cur.format)}</Chip>}
              {cur.season_year && <Chip icon={Calendar}>{cur.season_year}</Chip>}
              {eps > 0 && <Chip>{eps} Episodes</Chip>}
              <Chip className={cur.status === "RELEASING" ? "bg-emerald-400/15 text-emerald-300" : ""}>{statusLabel(cur.status)}</Chip>
            </div>

            <p className="mb-7 line-clamp-3 min-h-[4.5em] max-w-xl text-[15px] leading-relaxed text-white/65">{desc || cur.genres.join(" · ")}</p>

            <div className="flex flex-wrap items-center gap-3">
              <WatchLink to={`/watch/${cur.id}/1`}>
                <ShimmerButton background="linear-gradient(135deg,#ff1f2d,#c4000c)" shimmerColor="#ffb3b8" borderRadius="14px" className="h-12 gap-2 px-7 text-[15px] font-semibold">
                  <Play className="size-4 fill-white" />
                  Watch Now
                </ShimmerButton>
              </WatchLink>
              <Link
                to={animeHref(cur)}
                className="flex h-12 items-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.06] px-6 text-[15px] font-semibold text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/[0.12]"
              >
                <Info className="size-4" />
                Details
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide picker */}
      <div className="absolute right-4 bottom-8 left-4 flex items-center gap-3 sm:right-6 sm:left-auto lg:right-10">
        <button onClick={() => go(-1)} aria-label="Previous" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:bg-white/15">
          <ChevronLeft className="size-5" />
        </button>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto sm:flex-none">
          {slides.map((s, n) => (
            <button
              key={s.id}
              onClick={() => setI(n)}
              aria-label={titleOf(s.title)}
              className={cn(
                "relative h-16 w-12 shrink-0 overflow-hidden rounded-lg ring-1 transition duration-300 sm:h-20 sm:w-14",
                n === i ? "ring-2 ring-primary" : "opacity-50 ring-white/10 hover:opacity-90",
              )}
            >
              <img src={s.cover_image.large} alt="" className="size-full object-cover" />
              {n === i && (
                <motion.span
                  key={`p${i}${paused}`}
                  className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: paused ? 0 : 1 }}
                  transition={{ duration: paused ? 0 : INTERVAL / 1000, ease: "linear" }}
                />
              )}
            </button>
          ))}
        </div>
        <button onClick={() => go(1)} aria-label="Next" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:bg-white/15">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  )
}

function Chip({ children, icon: Icon, className }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 backdrop-blur-md", className)}>
      {Icon && <Icon className="size-3.5 opacity-70" />}
      {children}
    </span>
  )
}
