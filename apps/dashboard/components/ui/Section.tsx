import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { LABEL } from '@/components/glass/connect/recipes'

// A titled block inside a dashboard screen: the mono caps label (plain, descriptive), an optional
// note or action on the right, then the content. No rule or orange: spacing does the separating,
// like the sections of www.aeon.fun/docs.
export function Section({
  label,
  action,
  children,
  className,
  id,
}: {
  label: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className={LABEL}>
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
