// "Lite mode": phones (narrow screens) and visitors who prefer reduced motion get the same content
// without decorative animation (blur-fades, glow cards, tickers, beams, particles, WebGL grid),
// which is most of the startup JavaScript work on slow devices. Decided once at page load.
export const LITE =
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)").matches
