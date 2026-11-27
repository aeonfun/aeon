'use client'

import { MotionConfig } from 'motion/react'

import { ShapeProvider } from '@/components/glass/d/lib/shape-context'

// Pill controls across the variation; Motion drops transforms under reduced motion.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ShapeProvider defaultShape="pill">{children}</ShapeProvider>
    </MotionConfig>
  )
}
