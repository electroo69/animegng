import { useId, type SVGProps } from "react"

import { cn } from "@/lib/utils"

interface DotPatternProps extends SVGProps<SVGSVGElement> {
  width?: number
  height?: number
  x?: number
  y?: number
  cx?: number
  cy?: number
  cr?: number
  className?: string
}

// Static dot grid drawn with an SVG <pattern>: one element regardless of size, no measuring or per-dot animation.
export function DotPattern({ width = 16, height = 16, x = 0, y = 0, cx = 1, cy = 1, cr = 1, className, ...props }: DotPatternProps) {
  const id = useId()
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full text-neutral-400/80", className)} {...props}>
      <defs>
        <pattern id={id} width={width} height={height} x={x} y={y} patternUnits="userSpaceOnUse">
          <circle cx={cx} cy={cy} r={cr} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
