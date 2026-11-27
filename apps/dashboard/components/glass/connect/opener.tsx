// Every screen opens like the website's docs pages: the sky falls from night to paper, the logo
// (star and ouroboros) sits in its rings of light, then the screen's own header and content.
// `open` adds the website's entrance (data-open: the logo assembles, .v94-land lines rise).
import { Halo } from '@/components/glass/d/halo'
import { PulseLogo } from '@/components/glass/security/pulse-logo'
import { Sky } from '@/components/glass/security/sky'
import { cn } from '@/lib/cn'

export function Opener({
  open,
  className,
  children,
}: {
  open?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div data-open={open ? '' : undefined} className={cn('relative isolate', className)}>
      {/* Content after the opener must be positioned (relative) to paint above this overflow.
          The sky runs night to paper over its first 600px, so it never ends on an edge, even when
          the opener itself is shorter (the dashboard's controls row). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[max(100%,640px)]">
        <Sky />
      </div>
      <div className="flex justify-center pt-[clamp(104px,10vw,128px)]">
        <div className="v94-sun g-clear [--t:clamp(84px,min(12svh,22vw),112px)]!">
          <Halo strength={0.6} fade={[0.42, 0.8]} className="sec-halo" />
          <PulseLogo />
        </div>
      </div>
      {children}
    </div>
  )
}

/** Centered page header under the logo: one title, one short line. */
export function OpenerHeader({
  title,
  sub,
  children,
  className,
}: {
  title: React.ReactNode
  sub?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('mx-auto mt-[clamp(24px,3vw,40px)] max-w-3xl px-6 text-center', className)}>
      <h1
        className="v94-land font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] font-light tracking-[-0.04em] text-balance"
        style={{ '--d': '60ms' } as React.CSSProperties}
      >
        {title}
      </h1>
      {sub && (
        <p
          className="v94-land mx-auto mt-5 max-w-[44ch] font-display text-[clamp(1.0625rem,1.6vw,1.3125rem)] leading-[1.45] text-balance text-[var(--g-ink-soft)]"
          style={{ '--d': '120ms' } as React.CSSProperties}
        >
          {sub}
        </p>
      )}
      {children}
    </header>
  )
}
