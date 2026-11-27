'use client'

import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'

import { STAR_ORIGIN, StarMark } from '@/components/glass/d/emblem-parts'
import { RingHighlight } from '@/components/glass/d/ring-highlight'
import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { cn } from '@/lib/cn'

// Concentric bands of lighter violet light around the halo ring, like a slow sunrise. Each band is a
// faint disc, so the light steps up toward the center. On first view the bands rise from the
// inside out; then, once per run, one ring of light leaves the center and fades at the edge.
// Units: the tile is 100 wide at the center of a 1000 box. Decorative; under reduced motion
// the bands rest at full light and no ring runs. Paused while offscreen.
//
// Three layers, so iOS never repaints the big drawing: the bands are one still SVG (they rise
// as one layer on touch screens, band by band with a mouse), and the core and the run are their
// own small SVGs, moved only by opacity and scale (skin.css, .g-halo-*). Animated inside the one
// big SVG, every frame repainted it and the halo blinked on iPhones as its tiles redrew.
const BANDS = [64, 92, 128, 172, 226, 292, 372, 470]
// The run is drawn at RUN times its starting size and scaled from 1/RUN, so its line is sharp
// where it shows most (skin.css g-halo-run: 64 to 474 units, as 0.4 to 2.96).
const RUN = 2.5

/** `fade` melts the bands out toward the edge (fractions of the box's half width: full light up
 *  to the first, gone by the second). It is an SVG mask inside the drawing, not CSS mask-image:
 *  Safari on iOS flickers animated content under a CSS mask. */
export function Halo({
  className,
  strength = 1,
  fade,
}: {
  className?: string
  strength?: number
  fade?: [number, number]
}) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(true)
  const core = `v94-core-${useId().replace(/:/g, '')}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const r = 64 * RUN
  return (
    <span
      ref={ref}
      aria-hidden
      data-run={reduced ? undefined : visible ? 'on' : 'paused'}
      className={cn('v94-halo pointer-events-none block', className)}
    >
      <svg viewBox="-500 -500 1000 1000" className="g-halo-bands inset-0 size-full overflow-visible">
        {fade ? (
          <defs>
            <radialGradient id={`${core}-fade`} cx="0" cy="0" r="500" gradientUnits="userSpaceOnUse">
              <stop offset={fade[0]} stopColor="#fff" />
              <stop offset={fade[1]} stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id={`${core}-mask`} maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000">
              <rect x="-500" y="-500" width="1000" height="1000" fill={`url(#${core}-fade)`} />
            </mask>
          </defs>
        ) : null}
        <g mask={fade ? `url(#${core}-mask)` : undefined}>
          {/* Outer bands first so the inner ones stack the most light. */}
          {[...BANDS].reverse().map((b, i) => (
            <g key={b} className="g-halo-band" style={{ '--i': BANDS.length - 1 - i } as React.CSSProperties}>
              <circle r={b} fill={`oklch(0.74 0.017 240 / ${(0.04 + i * 0.004) * strength})`} />
              <circle
                r={b}
                fill="none"
                stroke={`oklch(0.9 0.012 240 / ${(0.07 + i * 0.012) * strength})`}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
      </svg>
      {/* The core: 300 of the 1000 box. */}
      <svg viewBox="-150 -150 300 300" className="g-halo-core size-[30%] overflow-visible">
        <defs>
          <radialGradient id={core} r="0.5">
            <stop offset="0" stopColor="oklch(0.78 0.014 240)" stopOpacity={0.55 * strength} />
            <stop offset="1" stopColor="oklch(0.6 0.022 240)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="150" fill={`url(#${core})`} />
      </svg>
      {/* The run: a ring of light, a wide soft stroke under a fine bright one, in a box just
          big enough for it (r + half the soft stroke, of the 1000 box). */}
      <svg
        viewBox={`${-(r + 10)} ${-(r + 10)} ${2 * (r + 10)} ${2 * (r + 10)}`}
        className="g-halo-run overflow-visible"
        style={{ width: `${(2 * (r + 10)) / 10}%`, height: `${(2 * (r + 10)) / 10}%` }}
      >
        <circle
          r={r}
          fill="none"
          stroke="oklch(0.85 0.012 240 / 0.16)"
          strokeWidth="14"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r={r}
          fill="none"
          stroke="oklch(0.95 0.012 240 / 0.8)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  )
}

// Faint concentric arcs at the top of a section: the hero rings, seen from far away. A small
// star sits on the outermost arc as the section marker, like a sun on the horizon.
export function Arcs({ className, star = true }: { className?: string; star?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-0 left-1/2 -z-10 h-[clamp(96px,11vw,160px)] w-screen max-w-none -translate-x-1/2',
        className,
      )}
    >
      <svg viewBox="0 0 1200 160" preserveAspectRatio="xMidYMin slice" className="absolute inset-0 size-full">
        {/* One far center below the seam; each arc peaks 28 units lower than the last. */}
        {[0, 1, 2, 3].map(i => (
          <circle
            key={i}
            cx="600"
            cy="2420"
            r={2400 - i * 28}
            fill="none"
            stroke={`oklch(0.9 0.012 240 / ${0.14 - i * 0.028})`}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* The outer arc peaks at 20 of 160; the star sits on it. */}
      {star ? (
        <SectionStar className="absolute top-[12.5%] left-1/2 size-[18px] -translate-x-1/2 -translate-y-[64%]" />
      ) : null}
    </div>
  )
}

// A small run marker for lists and steps: two rings of light around a center. The center is the
// v7 orange dot, the star (for the item that leads: direction, rank), or, for the item that
// loops, the dot circled by the ouroboros.
export function RingMark({ className, center = 'dot' }: { className?: string; center?: 'dot' | 'star' | 'loop' }) {
  return (
    <span aria-hidden className={cn('relative block shrink-0', className)}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-full overflow-visible">
        {center === 'loop' ? null : (
          <>
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="oklch(0.74 0.017 240 / 0.12)"
              stroke="oklch(0.9 0.012 240 / 0.3)"
              strokeWidth="1"
            />
            <circle
              cx="12"
              cy="12"
              r="7"
              fill="oklch(0.74 0.017 240 / 0.18)"
              stroke="oklch(0.9 0.012 240 / 0.45)"
              strokeWidth="1"
            />
          </>
        )}
        {center === 'star' ? null : <circle cx="12" cy="12" r="3.2" fill="var(--primary)" />}
      </svg>
      {center === 'star' ? (
        <StarMark className="absolute top-1/2 left-1/2 size-[62%] -translate-x-1/2 -translate-y-[54%]" />
      ) : null}
      {center === 'loop' ? <RingHighlight className="size-[150%]" /> : null}
    </span>
  )
}

/** A small star that turns one point into place the first time it scrolls into view. */
export function SectionStar({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  return (
    <motion.span
      aria-hidden
      className={cn('block size-4', className)}
      initial={reduced ? false : { opacity: 0, rotate: -72, scale: 0.6 }}
      whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
      transition={{ duration: 1.4, ease: [0.23, 1, 0.32, 1] }}
      style={{ transformOrigin: STAR_ORIGIN }}
    >
      <StarMark className="block size-full" />
    </motion.span>
  )
}
