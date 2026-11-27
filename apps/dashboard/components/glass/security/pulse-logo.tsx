'use client'

import { useState } from 'react'

import { HeroLogo } from '@/components/glass/d/parts'

/** The logo (star and ouroboros) as on the landing; a click sends a ring of light out from it.
 *  Each click adds its own ring, so quick clicks ripple; the last three are kept. */
export function PulseLogo() {
  const [rings, setRings] = useState<number[]>([])
  return (
    <>
      {rings.map(k => (
        <span
          key={k}
          aria-hidden
          className="g-sec-pulse"
          onAnimationEnd={() => setRings(r => r.filter(x => x !== k))}
        />
      ))}
      <HeroLogo onBeam={() => setRings(r => [...r.slice(-2), Date.now()])} />
    </>
  )
}
