'use client'

import { motion } from 'motion/react'

import { Ouroboros } from '@/components/glass/d/emblem-parts'
import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { cn } from '@/lib/cn'

/** A pen circle: the ouroboros centered on its parent (which must be `relative`), sized by
 *  `className`. It settles in with a small turn the first time it scrolls into view. Its clear
 *  center is 54% of its width at any angle, so the target must fit inside that. */
export function RingHighlight({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  return (
    <motion.span
      aria-hidden
      className={cn('pointer-events-none absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2', className)}
      initial={reduced ? false : { opacity: 0, rotate: -40, scale: 0.9 }}
      whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -20% 0px' }}
      transition={{ duration: 1.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <Ouroboros className="block size-full" />
    </motion.span>
  )
}
