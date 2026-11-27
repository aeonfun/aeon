'use client'

import { LiquidMetal } from '@paper-design/shaders-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { cn } from '@/lib/cn'
import { withBase } from '@/lib/base-path'

// The logo's star in orange metal: paper-shaders' LiquidMetal run over the star's exact shape
// (public/art/glass/star.png, rendered from the mark's own paths in StarMark's box), so the shape
// is never redrawn, only its material. It sits over an orange StarMark, which stays underneath as
// the exact edge and the fallback. The shader mounts once it is near the viewport, flows slowly
// only while on screen and `active`, and holds a still frame under reduced motion (or `still`).
// The metal is drawn in grey and mapped onto the logo's orange ramp by an SVG filter. Under it,
// parts.tsx StarStill holds the same first frame as a still. The ouroboros is flat white. Decorative.

type Props = { active?: boolean; still?: boolean; className?: string }

// How the grey metal is toned: the logo's orange ramp, or dark ink (soul.md's flame on the
// orange tile). The product marks' stills (product-mark.tsx) were captured with these filters.
const TONE = {
  orange: (id: string) => `saturate(0) contrast(0.9) brightness(1.15) url(#${id})`,
  ink: () => 'saturate(0) contrast(1.1) brightness(0.5)',
}

// WebKit (Safari, and every browser on iOS) draws the metal but not the SVG filter that tones it,
// so the orange star turned silver the moment the shader took over from the still. There the
// orange metal stays the still frame underneath; the ink tone needs no SVG filter and still runs.
const subscribe = () => () => {}
const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/(Chrome|Chromium|Edg)\//.test(navigator.userAgent)

function useNear() {
  const ref = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting)
        if (e.isIntersecting) setNear(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, near, visible }
}

const FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const
// Every shader draws at the same pixel count whatever its size on screen (the metal's look
// depends on it), so the stills under them (rendered here at this count) match their first frame.
const RES = 520 * 520

// The grey metal mapped onto the orange ramp: deep orange in the shade, light orange in the light.
const RAMP = {
  r: '0.769 0.794 0.82 0.846 0.871 0.897 0.923 0.949 0.974 1 1 1 1 1 1 1 1 1 1 1 1',
  g: '0.204 0.218 0.232 0.246 0.26 0.274 0.288 0.302 0.315 0.329 0.361 0.392 0.424 0.455 0.486 0.518 0.549 0.604 0.659 0.714 0.769',
  b: '0.039 0.048 0.057 0.065 0.074 0.083 0.092 0.1 0.109 0.118 0.14 0.162 0.185 0.207 0.23 0.252 0.275 0.353 0.431 0.51 0.588',
}

function Ramp({ id }: { id: string }) {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues={RAMP.r} />
          <feFuncG type="table" tableValues={RAMP.g} />
          <feFuncB type="table" tableValues={RAMP.b} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

/** The star in orange metal; lay it over an orange StarMark in the star's box. */
export function LiquidStar(props: Props) {
  return <LiquidShape image={withBase('/art/glass/star.png')} {...props} />
}

/** Any shape in the star's metal, from a white-on-clear mask PNG; lay it over its flat shape. */
export function LiquidShape({
  image,
  tone = 'orange',
  shadow = 'drop-shadow(0 0 0.6px rgb(255 255 255 / 0.8)) drop-shadow(0 3px 7px rgb(0 0 0 / 0.4))',
  active = true,
  still = false,
  className,
}: Props & { image: string; tone?: keyof typeof TONE; shadow?: string }) {
  const reduced = usePrefersReducedMotion()
  const webkit = useSyncExternalStore(subscribe, isWebKit, () => false)
  const { ref, near, visible } = useNear()
  const id = `star-ramp-${useId().replace(/:/g, '')}`
  if (webkit && tone === 'orange')
    return <span ref={ref} aria-hidden className={cn('pointer-events-none block', className)} />
  return (
    <span ref={ref} aria-hidden className={cn('pointer-events-none block', className)}>
      {tone === 'orange' && <Ramp id={id} />}
      {near ? (
        <LiquidMetal
          image={image}
          colorBack="#00000000"
          colorTint="#ffffff"
          repetition={3.6}
          softness={0.12}
          shiftRed={0.08}
          shiftBlue={0.04}
          distortion={0.12}
          contour={1}
          angle={110}
          fit="contain"
          scale={1}
          speed={still || reduced || !visible || !active ? 0 : 0.35}
          frame={2000}
          maxPixelCount={RES}
          minPixelRatio={8}
          style={{
            ...FILL,
            filter: `${TONE[tone](id)} ${shadow}`,
          }}
        />
      ) : null}
    </span>
  )
}
