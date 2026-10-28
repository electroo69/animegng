import { Link } from "react-router-dom"
import { CalendarDays } from "lucide-react"
import { Section } from "@/components/Section"
import { NumberTicker } from "@/components/ui/number-ticker"
import { RetroGrid } from "@/components/ui/retro-grid"
import { WordRotate } from "@/components/ui/word-rotate"
import { useSchedule } from "@/lib/api"
import { titleOf } from "@/lib/format"

// Below the fold on the home page; loaded lazily so its canvas grid and tickers stay out of the startup bundle.
export default function ScheduleBanner() {
  const { data } = useSchedule(0)
  const total = data?.schedule.reduce((n, d) => n + d.episodes.length, 0) ?? 0
  const names = data?.schedule.flatMap((d) => d.episodes.map((e) => titleOf(e.anime.title))).filter((t) => t.length < 34).slice(0, 12) ?? []
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#170a10] via-background to-[#0a0d22] px-6 py-14 sm:px-12">
        <RetroGrid className="opacity-60" angle={70} cellSize={50} lightLineColor="#ff1f2d" darkLineColor="#ff1f2d" />
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-brand-blue/25 blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 size-80 rounded-full bg-brand-red/25 blur-[100px]" />
        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">This week</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              <NumberTicker value={total || 0} className="text-white" /> new episodes
            </h2>
            <div className="mt-3 flex items-center gap-2 text-lg text-white/60">
              <span>including</span>
              {names.length > 0 && <WordRotate words={names} className="font-semibold text-white" duration={2200} />}
            </div>
          </div>
          <Link
            to="/schedule"
            className="flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-semibold text-black transition hover:bg-white/90 hover:shadow-[0_0_40px_-5px_rgba(255,255,255,0.6)]"
          >
            <CalendarDays className="size-4" />
            View schedule
          </Link>
        </div>
      </div>
    </Section>
  )
}
