import { useEffect, useState } from "react"
import { SITE_NAME, useHead } from "@/lib/seo"
import { animeHref } from "@/lib/seo"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Clock, Play } from "lucide-react"
import { Container } from "@/components/Section"
import { BlurFade } from "@/components/ui/blur-fade"
import { DotPattern } from "@/components/ui/dot-pattern"
import { userTz, useSchedule } from "@/lib/api"
import { countdown, formatLabel, titleOf } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function Schedule() {
  useHead({ title: `Anime Airing Schedule | ${SITE_NAME}`, description: "This week’s anime release schedule with air times in your timezone and countdowns to every new episode.", path: "/schedule" })
  const [week, setWeek] = useState(0)
  const { data, isLoading, isFetching } = useSchedule(week)
  const today = new Date().toLocaleDateString("en-CA")
  const [day, setDay] = useState(today)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // When switching weeks, select today if it's in range, otherwise the first day.
  useEffect(() => {
    if (!data) return
    if (!data.schedule.some((d) => d.date === day)) setDay(data.schedule.find((d) => d.date === today)?.date ?? data.schedule[0]?.date)
  }, [data, day, today])

  const selected = data?.schedule.find((d) => d.date === day)
  const fmtRange = (a: string, b: string) => {
    const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
    return `${new Date(a + "T00:00").toLocaleDateString(undefined, o)} – ${new Date(b + "T00:00").toLocaleDateString(undefined, o)}`
  }

  return (
    <div className="relative pt-24">
      <DotPattern className="absolute inset-x-0 top-0 h-80 text-white/[0.07] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
      <Container className="relative">
        <BlurFade className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">Release calendar</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Airing Schedule</h1>
            <p className="mt-2 text-sm text-white/45">Times are in your timezone ({userTz.replace(/_/g, " ")}).</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeek(week - 1)} aria-label="Previous week" className="grid size-10 place-items-center rounded-xl border border-white/10 hover:bg-white/[0.06]">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setWeek(0)} className={cn("h-10 rounded-xl border border-white/10 px-4 text-sm font-medium hover:bg-white/[0.06]", week === 0 && "border-primary/50 bg-primary/10")}>
              {data ? fmtRange(data.week_start, data.week_end) : "This week"}
            </button>
            <button onClick={() => setWeek(week + 1)} aria-label="Next week" className="grid size-10 place-items-center rounded-xl border border-white/10 hover:bg-white/[0.06]">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </BlurFade>

        <div className="no-scrollbar mt-8 grid auto-cols-[minmax(92px,1fr)] grid-flow-col gap-2 overflow-x-auto">
          {(data?.schedule ?? Array.from({ length: 7 }, () => null)).map((d, n) =>
            d ? (
              <button
                key={d.date}
                onClick={() => setDay(d.date)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-3 text-left transition",
                  day === d.date ? "border-primary/60 bg-gradient-to-br from-primary/25 to-brand-blue/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20",
                )}
              >
                <p className={cn("text-xs font-semibold tracking-wide uppercase", day === d.date ? "text-white" : "text-white/45")}>{d.day.slice(0, 3)}</p>
                <p className="mt-1 text-2xl font-black">{Number(d.date.slice(8))}</p>
                <p className="mt-1 text-[11px] text-white/40">{d.episodes.length} eps</p>
                {d.date === today && <span className="absolute top-3 right-3 size-2 rounded-full bg-primary" />}
              </button>
            ) : (
              <div key={n} className="h-[100px] animate-pulse rounded-2xl bg-white/[0.04]" />
            ),
          )}
        </div>

        <div className={cn("mt-8 transition-opacity", isFetching && !isLoading && "opacity-60")}>
          {isLoading && <div className="space-y-2">{Array.from({ length: 6 }, (_, n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div>}
          {selected && !selected.episodes.length && <p className="py-20 text-center text-white/45">Nothing scheduled for this day.</p>}
          <ol className="relative space-y-2 before:absolute before:top-2 before:bottom-2 before:left-[4.5rem] before:w-px before:bg-white/[0.07] sm:before:left-[5.5rem]">
            {selected?.episodes.map((e, n) => {
              const t = new Date(e.aired_at).getTime()
              const aired = t <= now
              return (
                <BlurFade key={`${e.anime.id}-${e.episode}`} delay={Math.min(n * 0.03, 0.4)}>
                  <li className="flex items-center gap-4 sm:gap-6">
                    <span className={cn("w-14 shrink-0 text-right font-mono text-sm font-semibold sm:w-[4.5rem]", aired ? "text-white/35" : "text-white")}>{e.local_time}</span>
                    <span className={cn("relative z-10 size-2.5 shrink-0 rounded-full ring-4 ring-background", aired ? "bg-white/25" : "bg-primary")} />
                    <Link
                      to={aired ? `/watch/${e.anime.id}/${e.episode}` : animeHref(e.anime)}
                      className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 pr-4 transition hover:border-white/15 hover:bg-white/[0.04]"
                    >
                      <img src={e.anime.cover_image.medium || e.anime.cover_image.large} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-semibold group-hover:text-white">{titleOf(e.anime.title)}</p>
                        <p className="mt-0.5 text-xs text-white/45">
                          Episode {e.episode}
                          {e.anime.episodes ? ` of ${e.anime.episodes}` : ""} · {formatLabel(e.anime.format)}
                        </p>
                      </div>
                      {aired ? (
                        <span className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white opacity-80 transition group-hover:opacity-100">
                          <Play className="size-3 fill-white" />
                          <span className="hidden sm:inline">Watch</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded-lg bg-brand-blue/15 px-3 py-1.5 font-mono text-xs text-[#a9b8ff]">
                          <Clock className="size-3" />
                          {countdown((t - now) / 1000)}
                        </span>
                      )}
                    </Link>
                  </li>
                </BlurFade>
              )
            })}
          </ol>
        </div>
      </Container>
    </div>
  )
}
