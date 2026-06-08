'use client'

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/* Effects ported from aeon-website/app/effects.tsx so the dashboard
   uses the same motion vocabulary as the marketing site. */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/* ──────────────────────────────────────────────────────────
   SCRAMBLE — headline letters decode from random glyphs.
   ────────────────────────────────────────────────────────── */
const GLYPHS = 'ABCDEFGHKNOPRSTUVXYZ0123456789#/'

export function Scramble({
  text,
  delay = 0,
  className,
}: {
  text: string
  delay?: number
  className?: string
}) {
  const rootRef = useRef<HTMLSpanElement>(null)

  useIsoLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const spans = Array.from(root.querySelectorAll<HTMLElement>('[data-c]'))
    const finals = spans.map((s) => s.dataset.c ?? '')
    if (prefersReducedMotion() || spans.length === 0) return

    const rand = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

    const settle = () => {
      spans.forEach((s, i) => {
        s.style.width = ''
        s.textContent = finals[i]
      })
    }

    spans.forEach((s) => {
      s.style.width = `${s.getBoundingClientRect().width}px`
      s.textContent = rand()
    })

    let raf = 0
    let started: number | null = null
    let lastSwap = 0
    const duration = 440 + spans.length * 20

    const tick = (now: number) => {
      if (started === null) started = now + delay
      const elapsed = now - started
      const progress = elapsed <= 0 ? 0 : Math.min(elapsed / duration, 1)
      const revealed = progress * spans.length
      const swap = now - lastSwap > 48
      if (swap) lastSwap = now

      spans.forEach((s, i) => {
        if (i < revealed) {
          if (s.textContent !== finals[i]) s.textContent = finals[i]
        } else if (swap) {
          s.textContent = rand()
        }
      })

      if (progress < 1) raf = requestAnimationFrame(tick)
      else settle()
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      settle()
    }
  }, [text, delay])

  const words = text.split(' ')
  return (
    <span
      ref={rootRef}
      className={className}
      aria-label={text}
      role="text"
    >
      {words.map((word, wi) => (
        <Fragment key={wi}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {[...word].map((ch, ci) => (
              <span
                key={ci}
                data-c={ch}
                style={{ display: 'inline-block', textAlign: 'center' }}
              >
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────
   FLIP — odometer reel that rolls each digit up to its value
   when scrolled into view.
   ────────────────────────────────────────────────────────── */
function Reel({ digit, delay }: { digit: number; delay: number }) {
  const [offset, setOffset] = useState(digit)
  const [animate, setAnimate] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    setOffset(0)

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setAnimate(true)
          setOffset(20 + digit)
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [digit])

  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        height: '1em',
        lineHeight: 1,
        overflow: 'hidden',
        verticalAlign: 'text-bottom',
      }}
    >
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          willChange: 'transform',
          transform: `translateY(-${offset}em)`,
          transition: animate
            ? `transform 1.5s cubic-bezier(0.2, 0.85, 0.25, 1) ${delay}ms`
            : 'none',
        }}
      >
        {Array.from({ length: 31 }).map((_, i) => (
          <span
            key={i}
            style={{
              height: '1em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  )
}

export function Flip({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const digits = String(value).split('')
  return (
    <span className={className} aria-label={String(value)} role="text">
      {digits.map((d, i) => (
        <Reel key={i} digit={Number(d)} delay={i * 90} />
      ))}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────
   VELOCITY MARQUEE — scrolls left continuously; scroll input
   boosts speed and momentarily drags it the other way.
   ────────────────────────────────────────────────────────── */
export function VelocityMarquee({
  children,
  className,
  trackClassName,
}: {
  children: ReactNode
  className?: string
  trackClassName?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track || prefersReducedMotion()) return

    let x = 0
    let raf = 0
    let last = performance.now()
    let boost = 0
    let lastScroll = window.scrollY

    const onScroll = () => {
      const cur = window.scrollY
      const delta = cur - lastScroll
      lastScroll = cur
      boost += -delta * 0.35
      boost = Math.max(-26, Math.min(26, boost))
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const base = -1.1
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      x += (base + boost) * dt
      const half = track.scrollWidth / 2
      if (half > 0) {
        if (x <= -half) x += half
        else if (x > 0) x -= half
      }
      track.style.transform = `translate3d(${x}px,0,0)`
      boost *= 0.9
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className={className}>
      <div ref={trackRef} className={trackClassName}>
        {children}
      </div>
    </div>
  )
}
