// A visible FAQ: the same questions and answers the edge renders for crawlers (worker/seo.js faqHtml).
import { ChevronDown } from "lucide-react"

export function Faq({ title, items }: { title: string; items: [string, string][] }) {
  if (!items.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-5 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {items.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-white/90 [&::-webkit-details-marker]:hidden">
              <h3>{q}</h3>
              <ChevronDown className="size-4 shrink-0 text-white/40 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-white/60">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
