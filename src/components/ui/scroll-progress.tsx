import { cn } from "@/lib/utils"

// Page scroll indicator driven by a CSS scroll timeline (index.css .scroll-progress): no JS or layout reads.
// Browsers without scroll-driven animations simply don't show it.
export function ScrollProgress({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("scroll-progress fixed inset-x-0 top-0 z-50 h-px origin-left", className)} />
}
