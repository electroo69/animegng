import { Link } from "react-router-dom"
import { SITE_NAME, useHead } from "@/lib/seo"
import { Home } from "lucide-react"
import { HyperText } from "@/components/ui/hyper-text"
import { Ripple } from "@/components/ui/ripple"

export default function NotFound({ message = "This page wandered off into another isekai." }: { message?: string }) {
  useHead({ title: `Page not found | ${SITE_NAME}`, noindex: true })
  return (
    <div className="relative grid min-h-[80vh] place-items-center overflow-hidden px-4 pt-16">
      <Ripple mainCircleSize={260} numCircles={7} />
      <div className="relative text-center">
        <HyperText as="h1" className="text-8xl font-black tracking-tighter text-gradient-brand sm:text-9xl" duration={1200}>
          404
        </HyperText>
        <p className="mt-4 text-white/55">{message}</p>
        <Link to="/" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/85">
          <Home className="size-4" />
          Back home
        </Link>
      </div>
    </div>
  )
}
