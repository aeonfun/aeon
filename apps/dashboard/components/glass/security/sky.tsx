// Copied from aeon-website components/glass/security/hero.tsx: just Sky, rand and DOTS (the
// subpage sky every glass screen opens on). Styles: .g-sec-sky / .g-sec-dawn in security.css.

function rand(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A few live stars in the night band at the top (1440 x 260), thinning as the sky pales.
const DOTS = (() => {
  const r = rand(71)
  return Array.from({ length: 34 }, (_, i) => ({
    x: r() * 1440,
    y: Math.pow(r(), 1.8) * 240,
    s: 0.6 + r() * 1,
    d: `${(i % 9) * 0.45}s`,
    t: `${3 + (i % 5)}s`,
  }))
})()

/** The page's sky: one smooth fall from night to the paper (security.css), live stars in the
 *  night, and a soft dawn where the words sit. */
export function Sky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="g-sec-sky absolute inset-0" />
      <svg
        viewBox="0 0 1440 260"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-x-0 top-0 h-[260px] w-full"
      >
        {DOTS.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.s}
            fill="oklch(0.985 0.005 220)"
            className="v94-twinkle"
            style={{ '--tw': d.t, '--twd': d.d } as React.CSSProperties}
          />
        ))}
      </svg>
      <div className="g-sec-dawn absolute inset-0" />
    </div>
  )
}
