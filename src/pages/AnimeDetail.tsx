import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "motion/react"
import { Award, Clock, ExternalLink, Heart, Play, PlayCircle, Star, TrendingUp, Users } from "lucide-react"
import { AnimeCard, CardSkeleton } from "@/components/AnimeCard"
import { EpisodeGrid } from "@/components/EpisodeGrid"
import { Container, Rail, Section, SectionHeader } from "@/components/Section"
import { BorderBeam } from "@/components/ui/border-beam"
import { BlurFade } from "@/components/ui/blur-fade"
import { MagicCard } from "@/components/ui/magic-card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAnime, useEpisodes, type AnimeDetail as Detail } from "@/lib/api"
import { availableEpisodes, cap, countdown, formatLabel, statusLabel, stripHtml, titleOf } from "@/lib/format"
import { lastEpisode } from "@/lib/progress"
import { cn } from "@/lib/utils"
import NotFound from "./NotFound"

const TABS = ["Episodes", "Characters", "Related", "Details"] as const

export default function AnimeDetail() {
  const id = Number(useParams().id)
  const { data: a, isLoading, error } = useAnime(id)
  const episodes = useEpisodes(id)
  const [tab, setTab] = useState<(typeof TABS)[number]>("Episodes")
  const [trailer, setTrailer] = useState(false)
  const [more, setMore] = useState(false)

  if (error) return <NotFound message="We couldn't find that anime." />
  if (isLoading || !a) return <DetailSkeleton />

  const fanart = a.artwork?.find((x) => x.coverType === "Fanart")?.url
  const logo = a.artwork?.find((x) => x.coverType === "Clearlogo")?.url
  const bg = a.banner_image ?? fanart ?? a.cover_image.extra_large
  const desc = stripHtml(a.description)
  const eps = episodes.data?.total ?? availableEpisodes(a)
  const resume = lastEpisode(a.id)
  const rated = a.rankings.find((r) => r.type === "RATED" && r.allTime)
  const popular = a.rankings.find((r) => r.type === "POPULAR" && r.allTime)
  const accent = a.cover_image.color ?? "#ff1f2d"

  return (
    <>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-[560px] overflow-hidden">
          <motion.img initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2 }} src={bg} alt="" className="size-full object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent" />
          <div className="absolute top-40 left-1/4 size-96 rounded-full opacity-25 blur-[120px]" style={{ background: accent }} />
        </div>

        <Container className="relative pt-32 lg:pt-44">
          <div className="flex flex-col gap-8 md:flex-row md:items-end">
            <BlurFade className="mx-auto w-52 shrink-0 md:mx-0 md:w-64">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                <img src={a.cover_image.extra_large} alt={titleOf(a.title)} className="size-full object-cover" />
                <BorderBeam size={140} duration={8} colorFrom="#ff1f2d" colorTo="#2b4bff" borderWidth={2} />
              </div>
            </BlurFade>

            <BlurFade delay={0.1} className="min-w-0 flex-1 text-center md:text-left">
              <div className="mb-3 flex flex-wrap justify-center gap-2 text-xs font-semibold md:justify-start">
                <span className={cn("rounded-md px-2 py-1", a.status === "RELEASING" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/80")}>{statusLabel(a.status)}</span>
                {a.format && <span className="rounded-md bg-white/10 px-2 py-1 text-white/80">{formatLabel(a.format)}</span>}
                {a.season && <span className="rounded-md bg-white/10 px-2 py-1 text-white/80">{cap(a.season)} {a.season_year}</span>}
                {a.is_adult && <span className="rounded-md bg-primary/20 px-2 py-1 text-primary">18+</span>}
              </div>
              {logo ? (
                <>
                  <h1 className="sr-only">{titleOf(a.title)}</h1>
                  <img src={logo} alt="" className="mx-auto mb-3 max-h-32 max-w-full object-contain md:mx-0" />
                </>
              ) : (
                <h1 className="text-3xl leading-tight font-black tracking-tight sm:text-4xl lg:text-5xl">{titleOf(a.title)}</h1>
              )}
              <p className="mt-2 text-sm text-white/45">{[a.title.romaji !== titleOf(a.title) && a.title.romaji, a.title.native].filter(Boolean).join(" · ")}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5 md:justify-start">
                {a.genres.map((g) => (
                  <Link key={g} to={`/search?genre=${encodeURIComponent(g)}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/65 transition hover:border-primary/50 hover:text-white">
                    {g}
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {eps > 0 ? (
                  <Link to={`/watch/${a.id}/${resume ?? 1}`}>
                    <ShimmerButton background="linear-gradient(135deg,#ff1f2d,#c4000c)" shimmerColor="#ffb3b8" borderRadius="14px" className="h-12 gap-2 px-7 font-semibold">
                      <Play className="size-4 fill-white" />
                      {resume ? `Continue EP ${resume}` : "Watch EP 1"}
                    </ShimmerButton>
                  </Link>
                ) : (
                  <span className="flex h-12 items-center rounded-[14px] border border-white/10 bg-white/[0.04] px-6 text-sm text-white/60">Not yet released</span>
                )}
                {a.trailer?.site === "youtube" && (
                  <button onClick={() => setTrailer(true)} className="flex h-12 items-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.06] px-6 font-semibold backdrop-blur-md transition hover:bg-white/[0.12]">
                    <PlayCircle className="size-4" />
                    Trailer
                  </button>
                )}
              </div>
              {a.next_airing_episode && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue/15 px-3 py-1.5 text-sm text-[#9fb0ff]">
                  <Clock className="size-4" />
                  Episode {a.next_airing_episode.episode} airs in {countdown(a.next_airing_episode.time_until_airing)}
                </p>
              )}
            </BlurFade>
          </div>

          {/* Stats */}
          <BlurFade delay={0.2} className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Star} label="Average score" value={a.average_score ? a.average_score / 10 : 0} decimals={1} suffix="/10" color="#fbbf24" />
            <Stat icon={Users} label="Members" value={a.popularity ?? 0} color="#2b4bff" />
            <Stat icon={Heart} label="Favourites" value={a.favourites ?? 0} color="#ff1f2d" />
            {rated ? <Stat icon={Award} label="Highest rated all time" value={rated.rank} prefix="#" color="#a78bfa" /> : <Stat icon={TrendingUp} label="Most popular all time" value={popular?.rank ?? 0} prefix="#" color="#a78bfa" />}
          </BlurFade>

          {desc && (
            <BlurFade delay={0.25} className="mt-8 max-w-4xl">
              <p className={cn("text-[15px] leading-relaxed whitespace-pre-line text-white/65", !more && "line-clamp-4")}>{desc}</p>
              {desc.length > 380 && (
                <button onClick={() => setMore(!more)} className="mt-2 text-sm font-medium text-primary hover:underline">
                  {more ? "Show less" : "Read more"}
                </button>
              )}
            </BlurFade>
          )}

          {/* Tabs */}
          <div className="sticky top-16 z-30 -mx-4 mt-12 border-b border-white/[0.07] bg-background/80 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <div className="no-scrollbar flex gap-6 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("relative py-4 text-sm font-semibold whitespace-nowrap text-white/45 transition hover:text-white", tab === t && "text-white")}>
                  {t}
                  {t === "Episodes" && eps > 0 && <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">{eps}</span>}
                  {tab === t && <motion.span layoutId="detail-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-brand-red to-brand-blue" />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 min-h-[300px]">
            {tab === "Episodes" &&
              (episodes.isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, n) => <CardSkeleton key={n} landscape />)}</div>
              ) : eps > 0 ? (
                <EpisodeGrid animeId={a.id} episodes={episodes.data?.data ?? []} total={eps} fallbackImage={a.banner_image} />
              ) : (
                <p className="py-16 text-center text-white/45">No episodes have aired yet.</p>
              ))}
            {tab === "Characters" && <Characters a={a} />}
            {tab === "Related" && <Related a={a} />}
            {tab === "Details" && <Details a={a} />}
          </div>

          {a.recommendations.length > 0 && (
            <Section className="mt-16">
              <SectionHeader eyebrow="If you liked this" title="Recommended" />
              <Rail>
                {a.recommendations.map((r) => (
                  <div key={r.id} className="w-[42vw] shrink-0 snap-start sm:w-[190px]">
                    <AnimeCard anime={r} />
                  </div>
                ))}
              </Rail>
            </Section>
          )}
        </Container>
      </div>

      <Dialog open={trailer} onOpenChange={setTrailer}>
        <DialogContent className="max-w-4xl! overflow-hidden border-white/10 bg-black p-0 sm:max-w-4xl" showCloseButton>
          <DialogTitle className="sr-only">Trailer</DialogTitle>
          {trailer && a.trailer && (
            <iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${a.trailer.id}?autoplay=1&rel=0`} allow="autoplay; encrypted-media; fullscreen" allowFullScreen title="Trailer" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stat({ icon: Icon, label, value, decimals = 0, prefix, suffix, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: number; decimals?: number; prefix?: string; suffix?: string; color: string }) {
  return (
    <MagicCard gradientFrom={color} gradientTo="#2b4bff" gradientColor="#1a1220" gradientOpacity={0.5} className="rounded-2xl">
      <div className="relative z-40 p-5">
        <Icon className="size-5" style={{ color }} />
        <div className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {prefix}
          {value ? <NumberTicker value={value} decimalPlaces={decimals} className="text-white" /> : "—"}
          {suffix && <span className="text-base font-medium text-white/40">{suffix}</span>}
        </div>
        <p className="mt-1 text-xs text-white/45">{label}</p>
      </div>
    </MagicCard>
  )
}

function Characters({ a }: { a: Detail }) {
  if (!a.characters.length) return <p className="py-16 text-center text-white/45">No character data.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {a.characters.map((c) => {
        const va = c.voice_actors.find((v) => v.language === "Japanese") ?? c.voice_actors[0]
        return (
          <div key={c.id} className="flex items-stretch overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <img src={c.image} alt="" loading="lazy" className="h-24 w-16 object-cover" />
            <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-white/40">{cap(c.role)}</p>
            </div>
            {va && (
              <>
                <div className="flex min-w-0 flex-1 flex-col items-end justify-center px-3 text-right">
                  <p className="truncate text-sm">{va.name}</p>
                  <p className="text-xs text-white/40">{va.language}</p>
                </div>
                <img src={va.image} alt="" loading="lazy" className="h-24 w-16 object-cover" />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Related({ a }: { a: Detail }) {
  const anime = a.relations.filter((r) => r.type === "ANIME")
  const other = a.relations.filter((r) => r.type !== "ANIME")
  if (!a.relations.length) return <p className="py-16 text-center text-white/45">No related titles.</p>
  return (
    <div className="space-y-10">
      {anime.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {anime.map((r) => (
            <div key={r.id}>
              <p className="mb-2 font-mono text-[10.5px] tracking-widest text-primary uppercase">{cap(r.relation_type)}</p>
              <AnimeCard anime={r} />
            </div>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-white/60">Source material</p>
          <div className="flex flex-wrap gap-3">
            {other.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 pr-4">
                <img src={r.cover_image.medium} alt="" className="h-14 w-10 rounded object-cover" />
                <div>
                  <p className="text-sm font-medium">{titleOf(r.title)}</p>
                  <p className="text-xs text-white/40">
                    {cap(r.relation_type)} · {cap(r.format ?? r.type)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Details({ a }: { a: Detail }) {
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "?")
  const rows: [string, React.ReactNode][] = [
    ["Format", formatLabel(a.format)],
    ["Episodes", a.episodes ?? "?"],
    ["Duration", a.duration ? `${a.duration} min` : "?"],
    ["Status", statusLabel(a.status)],
    ["Aired", `${fmtDate(a.start_date)} → ${a.end_date ? fmtDate(a.end_date) : a.status === "RELEASING" ? "now" : "?"}`],
    ["Season", a.season ? `${cap(a.season)} ${a.season_year}` : "?"],
    ["Source", cap(a.source)],
    ["Studios", a.studios.filter((s) => s.is_main).map((s) => s.name).join(", ") || "?"],
    ["Producers", a.studios.filter((s) => !s.is_main).map((s) => s.name).join(", ") || "—"],
    ["Also known as", a.synonyms.slice(0, 4).join(" · ") || "—"],
  ]
  const tags = a.tags.filter((t) => !t.isMediaSpoiler).slice(0, 20)
  const links = a.external_links.filter((l) => l.type === "STREAMING" || l.type === "INFO" || !l.type).slice(0, 12)
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-5 py-3 text-sm">
            <dt className="w-32 shrink-0 text-white/40">{k}</dt>
            <dd className="text-white/85">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-8">
        {tags.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-white/60">Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link key={t.id} to={`/search?tag=${encodeURIComponent(t.name)}`} title={t.description} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 transition hover:border-primary/50 hover:text-white">
                  {t.name} <span className="text-white/30">{t.rank}%</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {links.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-white/60">External links</p>
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white" style={{ borderColor: l.color ? `${l.color}55` : undefined }}>
                  {l.site}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <Container className="pt-44">
      <div className="flex flex-col gap-8 md:flex-row md:items-end">
        <div className="mx-auto aspect-[2/3] w-52 animate-pulse rounded-2xl bg-white/[0.05] md:mx-0 md:w-64" />
        <div className="flex-1 space-y-4">
          <div className="h-12 w-2/3 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-12 w-48 animate-pulse rounded-xl bg-white/[0.05]" />
        </div>
      </div>
    </Container>
  )
}
