import { Link, type LinkProps } from "react-router-dom"
import { usePrefetchDirect } from "@/lib/direct"
import { loadPrefs } from "@/lib/progress"

// A link to /watch/:id/:ep that looks up the episode's stream on hover/focus, so the player
// can start as soon as the page opens.
export function WatchLink({ to, onPointerEnter, onFocus, ...props }: LinkProps & { to: string }) {
  const prefetch = usePrefetchDirect()
  const warm = () => {
    const m = /^\/watch\/(\d+)\/(\d+)/.exec(to)
    if (m) prefetch(Number(m[1]), Number(m[2]), loadPrefs().lang)
  }
  return (
    <Link
      to={to}
      onPointerEnter={(e) => {
        warm()
        onPointerEnter?.(e)
      }}
      onFocus={(e) => {
        warm()
        onFocus?.(e)
      }}
      {...props}
    />
  )
}
