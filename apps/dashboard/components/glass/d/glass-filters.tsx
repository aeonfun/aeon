// The glass skin's refraction, for `backdrop-filter: url(#...)` (Chromium only; body-scope.tsx
// flags it). A slow fractal noise bends what lies behind the panel, the way poured glass is never
// quite flat: low frequency, so the page under the nav and the cards swims a little as it passes
// instead of breaking up. Chromium does not load images (feImage) inside a backdrop filter, so the
// map is procedural. Safari and Firefox never read these and keep the plain blur. Decorative.

function Refract({ id, freq, scale, seed }: { id: string; freq: string; scale: number; seed: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={seed} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  )
}

export function GlassFilters() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden">
      {/* The nav pill: long ripples along its length. */}
      <Refract id="g-refract-pill" freq="0.006 0.04" scale={34} seed={7} />
      {/* Panels and cards: an even, slow swell. */}
      <Refract id="g-refract-card" freq="0.012 0.016" scale={30} seed={3} />
    </svg>
  )
}
