// Trust pages: /about, /contact, /dmca, /terms. The copy lives in worker/content.js, which the edge
// renders for crawlers too.
import { Link } from "react-router-dom"
import { Container } from "@/components/Section"
import { SITE_NAME, useHead } from "@/lib/seo"
import { CONTACT_EMAIL, LEGAL } from "../../worker/content.js"

const PAGES = ["about", "contact", "dmca", "terms"] as const

// The contact address becomes a mail link wherever it appears in the copy.
function Text({ children }: { children: string }) {
  const parts = children.split(CONTACT_EMAIL)
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>}
          {part}
        </span>
      ))}
    </>
  )
}

function Legal({ page }: { page: (typeof PAGES)[number] }) {
  const d = LEGAL[page]
  useHead({ title: `${d.title} | ${SITE_NAME}`, description: d.description, path: `/${page}` })
  return (
    <Container className="max-w-3xl pt-24 text-[15px] leading-relaxed text-white/65">
      <h1 className="text-3xl font-black tracking-tight text-white">{d.title}</h1>
      {d.sections.map(([h, ...ps]) => (
        <section key={h}>
          <h2 className="mt-8 text-lg font-bold text-white">{h}</h2>
          {ps.map((p) => (
            <p key={p} className="mt-2"><Text>{p}</Text></p>
          ))}
        </section>
      ))}
      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-6 text-sm">
        {PAGES.filter((p) => p !== page).map((p) => (
          <Link key={p} to={`/${p}`} className="text-white/50 hover:text-white">{LEGAL[p].title}</Link>
        ))}
        <Link to="/privacy" className="text-white/50 hover:text-white">Privacy Policy</Link>
      </p>
    </Container>
  )
}

export const About = () => <Legal page="about" />
export const Contact = () => <Legal page="contact" />
export const Dmca = () => <Legal page="dmca" />
export const Terms = () => <Legal page="terms" />
