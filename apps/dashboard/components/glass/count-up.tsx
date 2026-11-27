'use client'

import { animate, useInView } from 'motion/react'
import { useEffect, useRef } from 'react'

import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { cn } from '@/lib/cn'

type Props = {
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** Seconds. */
  duration?: number
  delay?: number
  /** Start on the parent's signal (its own in-view), so a row or a panel counts as one. */
  run?: boolean
  className?: string
}

function format(v: number, decimals: number, prefix: string, suffix: string) {
  return (
    prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  )
}

/** A figure that counts up from zero the first time it scrolls into view. The final figure holds
 *  the width (invisible), so nothing around it moves while it counts; screen readers get the
 *  final figure only. Under reduced motion it shows the final figure at once. */
export function CountUp({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.6,
  delay = 0,
  run,
  className,
}: Props) {
  const box = useRef<HTMLSpanElement>(null)
  const out = useRef<HTMLSpanElement>(null)
  const inView = useInView(box, { once: true, margin: '0px 0px -8% 0px' })
  const seen = run ?? inView
  const reduced = usePrefersReducedMotion()
  const final = format(to, decimals, prefix, suffix)

  useEffect(() => {
    const el = out.current
    if (!el || !seen) return
    if (reduced) {
      el.textContent = final
      return
    }
    const c = animate(0, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => {
        el.textContent = format(v, decimals, prefix, suffix)
      },
    })
    return () => c.stop()
  }, [seen, reduced, to, decimals, prefix, suffix, duration, delay, final])

  return (
    <span ref={box} className={cn('relative inline-block', className)}>
      {/* Only the shown figure copies: the sizer and the reader's copy are left out of a selection. */}
      <span aria-hidden className="invisible select-none">
        {final}
      </span>
      <span ref={out} aria-hidden className="absolute inset-0 whitespace-nowrap">
        {format(0, decimals, prefix, suffix)}
      </span>
      <span className="sr-only select-none">{final}</span>
    </span>
  )
}
