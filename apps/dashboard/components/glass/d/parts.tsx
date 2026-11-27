'use client'

import { easeOut, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'motion/react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { Ouroboros, RING_WHITE, STAR_ORANGE, StarMark } from '@/components/glass/d/emblem-parts'
import { Halo } from '@/components/glass/d/halo'
import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { site } from '@/content/d-site'
import { cn } from '@/lib/cn'
import { withBase } from '@/lib/base-path'

// The star's metal is WebGL, so it loads in the browser only, after the page.
const LiquidStar = dynamic(() => import('@/components/glass/d/liquid-mark').then(m => m.LiquidStar), { ssr: false })

/** A still frame of the star's orange metal (public/art/glass/star-orange.webp), so the star is metal from
 *  the first frame; the live shader (LiquidStar) paints over it once it loads. The shadow is
 *  LiquidStar's own, added here at screen size. */
function StarStill({ eager }: { eager?: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 block">
      <Image
        src={withBase('/art/glass/star-orange.webp')}
        alt=""
        fill
        sizes="(max-width: 1023px) 320px, 640px"
        loading={eager ? 'eager' : undefined}
        className="object-fill [filter:drop-shadow(0_0_0.6px_rgb(255_255_255/0.8))_drop-shadow(0_3px_7px_rgb(0_0_0/0.4))]"
      />
    </span>
  )
}

// Each part has a job. Star and ouroboros together are the logo (the hero sun, the ecosystem
// center, and the close, where the star rises into the ring and they form the mark). The
// ouroboros alone circles what loops; the star alone marks sections and steps. Highlights are
// decorative (aria-hidden) and rest in their final state under reduced motion.

/** The hero logo, assembled on load: the ring turns in, the star rises into it from below, and
 *  once it lands the ring opens its see-through cut around it, exactly the mark's own outline
 *  (the same geometry as BareMark). The motion is CSS (theme.css, [data-open]); under reduced
 *  motion the two parts simply rest as the mark. */
export function HeroLogo({ onBeam }: { onBeam?: () => void }) {
  const reduced = usePrefersReducedMotion()
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setLanded(true), 1500)
    return () => window.clearTimeout(t)
  }, [])
  // While the star turns under the pointer the ring closes its cut and shows whole; the cut
  // opens again each time the star comes to rest.
  const [turning, setTurning] = useState(false)
  const turn = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && !reduced) setTurning(true)
  }
  return (
    // A button: it turns under the pointer, and a click sends light out along the branches.
    <button
      type="button"
      aria-label={site.ui.beam}
      onClick={onBeam}
      onPointerEnter={turn}
      onPointerLeave={turn}
      className="d-turn block size-full cursor-pointer rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[var(--primary)]"
    >
      <span role="img" aria-label={site.alt.emblem} className="v94-logo">
        <span aria-hidden className="v94-logo-ring" style={RING_BOX}>
          <Ouroboros
            starCut={(reduced || landed) && !turning}
            fade={turning ? 120 : 250}
            color={RING_WHITE}
            className="block size-full"
          />
        </span>
        <span
          aria-hidden
          className="v94-logo-star d-turn-mark"
          style={STAR_BOX}
          onTransitionEnd={e => e.propertyName === 'rotate' && setTurning(false)}
        >
          <StarMark color={STAR_ORANGE} className="block size-full" />
          <StarStill eager />
          <LiquidStar className="absolute inset-0" />
        </span>
      </span>
    </button>
  )
}

// Where each part sits inside the mark's 1024 box (the boxes emblem-parts crops to).
const pct = (n: number) => `${(n / 1024) * 100}%`
const RING_BOX = { left: pct(92), top: pct(86), width: pct(844), height: pct(854) }
const STAR_BOX = { left: pct(66), top: pct(72), width: pct(895), height: pct(853) }

/** The close: the star rises from below the horizon like a sun while the ring turns back to
 *  rest; when the section reaches the middle of the screen they meet as the mark. Rings of
 *  light sit around it, never over it. */
export function RisingMark({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const sky = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sky, offset: ['start 0.95', 'end 0.62'] })
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.0005 })
  // The star starts fully under the horizon (118% of its own height down) and lands at 0.
  const y = useTransform(p, [0, 1], ['118%', '0%'], { ease: easeOut })
  const rotate = useTransform(p, [0, 1], [-140, 0], { ease: easeOut })
  // Once the star is home the ring opens its see-through cut around it (the mark's own outline).
  const [landed, setLanded] = useState(false)
  useMotionValueEvent(p, 'change', v => setLanded(v > 0.995))
  // Once home it turns under the pointer like the hero logo, the ring closing its cut meanwhile.
  const [turning, setTurning] = useState(false)
  const turn = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && !reduced && landed) setTurning(true)
  }

  return (
    <div ref={sky} className={cn('v94-sky relative w-full overflow-hidden', className)}>
      <div
        className={cn('v94-meet relative z-[2] mx-auto', (reduced || landed) && 'd-turn')}
        onPointerEnter={turn}
        onPointerLeave={turn}
      >
        {/* Light around the mark, with its center masked out so the parts sit on the plain
            field. The wrapper fades
            the light out toward the top of the sky, so no band ends on a hard edge. */}
        <div className="v94-meet-light">
          <Halo
            strength={0.8}
            className="size-full [mask-image:radial-gradient(closest-side,transparent_19%,#000_30%,#000_52%,transparent_92%)]"
          />
        </div>
        {/* A soft shadow holds the white ring on the pale sky. */}
        <motion.div
          aria-hidden
          className="absolute drop-shadow-[0_2px_6px_rgb(20_24_30/0.22)]"
          style={{ ...RING_BOX, rotate: reduced ? 0 : rotate }}
        >
          <Ouroboros
            starCut={(reduced || landed) && !turning}
            fade={turning ? 120 : 400}
            color={RING_WHITE}
            className="block size-full"
          />
        </motion.div>
        {/* The star is clipped by the horizon (the bottom of this box). */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <motion.div className="absolute" style={{ ...STAR_BOX, y: reduced ? '0%' : y }}>
            <span
              className="d-turn-mark absolute inset-0 block"
              style={{ transformOrigin: '50% 55.1%' }}
              onTransitionEnd={e => e.propertyName === 'rotate' && setTurning(false)}
            >
              <StarMark color={STAR_ORANGE} className="block size-full" />
              <StarStill />
              <LiquidStar className="absolute inset-0" />
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
