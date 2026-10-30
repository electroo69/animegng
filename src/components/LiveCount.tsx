import { usePresence } from "@/lib/presence"
import { cn } from "@/lib/utils"

export const LiveDot = () => (
  <span className="relative flex size-2 shrink-0">
    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
    <span className="relative size-2 rounded-full bg-emerald-400" />
  </span>
)

export function LiveCount({ className }: { className?: string }) {
  const { n } = usePresence()
  if (!n) return null
  return (
    <span title="People on the site right now" className={cn("items-center gap-1.5 text-xs font-medium whitespace-nowrap text-white/60 tabular-nums", className)}>
      <LiveDot />
      {n.toLocaleString()} online
    </span>
  )
}
