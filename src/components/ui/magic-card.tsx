import { lazy, Suspense } from "react"
import { LITE } from "@/lib/lite"
import { cn } from "@/lib/utils"
import type { MagicCardProps } from "./magic-card-animated"

// The pointer-following glow pulls in the animation library, so it loads after the page; until then (and in
// lite mode) the card renders as a plain bordered box.
const MagicCardAnimated = lazy(() => import("./magic-card-animated"))

export function MagicCard(props: MagicCardProps) {
  const plain = <div className={cn("relative overflow-hidden rounded-[inherit] border border-white/[0.07] bg-background", props.className)}>{props.children}</div>
  if (LITE) return plain
  return (
    <Suspense fallback={plain}>
      <MagicCardAnimated {...props} />
    </Suspense>
  )
}
