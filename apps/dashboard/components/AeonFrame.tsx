'use client'

// The frame around the local dashboard, from the glass Connect frame (components/glass/connect/frame
// + nav): skip link, the website's nav (logo, then the harness and model selects; Pull / Push /
// GitHub beads and the site menu on the right), the light paper under the page, and the glass
// footer. No account control: the local dashboard is single-user and needs no sign-in.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MetalMark } from '@/components/glass/d/metal-mark'
import { cn } from '@/lib/cn'
import { MenuActions, MenuOverlay, MenuToggle } from '@/components/glass/d/menu'
import { Footer } from '@/components/glass/d/sections/footer'
import { site } from '@/content/d-site'

function AeonNav({ lead, extra }: { lead?: React.ReactNode; extra?: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  // Past the sky: the content columns can reach the strip above the bar.
  const [pastSky, setPastSky] = useState(false)
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    // A sentinel at the top of the page, so no scroll listener runs.
    const el = document.getElementById('top')
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    const sky = new IntersectionObserver(([e]) => setPastSky(!e.isIntersecting), {
      rootMargin: '220px 0px 0px 0px',
    })
    sky.observe(el)
    return () => {
      io.disconnect()
      sky.disconnect()
    }
  }, [])

  const live = scrolled && !open

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
        {/* Scrolled: a paper band that fades out under the bar, so content never peeks above it. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 -z-10 h-[4.5rem] bg-[linear-gradient(to_bottom,oklch(0.965_0.006_235)_0,oklch(0.965_0.006_235)_1.75rem,oklch(0.965_0.006_235/0)_100%)] transition-opacity duration-200',
            pastSky && !open ? 'opacity-100' : 'opacity-0',
          )}
        />
        <nav
          ref={navRef}
          aria-label="Primary"
          data-solid={live || undefined}
          data-menu-open={open || undefined}
          className="group/nav g-nav mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-full pr-2 pl-4 sm:pl-5"
        >
          <Link
            href="/"
            aria-label="Aeon - dashboard home"
            className="d-turn relative -ml-1 flex h-11 min-w-0 shrink-0 items-center gap-2.5 rounded-full px-1"
          >
            <MetalMark className="size-8" />
            <span className="font-display text-[1.6rem] leading-none tracking-[-0.02em] italic">Aeon</span>
          </Link>
          {lead && <div className="ml-3 flex min-w-0 items-center gap-2 group-data-[menu-open]/nav:hidden">{lead}</div>}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <MenuActions open={open} />
            {extra}
            <MenuToggle ref={toggleRef} open={open} onClick={() => (open ? close() : setOpen(true))} />
          </div>
        </nav>
      </header>
      <MenuOverlay open={open} onClose={close} navRef={navRef} />
    </>
  )
}

export function AeonFrame({
  navLead,
  navExtra,
  children,
}: {
  /** Controls right after the logo (harness and model). */
  navLead?: React.ReactNode
  /** Controls before the menu toggle (Pull / Push / GitHub). */
  navExtra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-foreground px-5 py-3 text-[15px] font-medium text-[var(--primary-foreground)] focus-visible:translate-y-0"
      >
        {site.ui.skipToContent}
      </a>
      <AeonNav lead={navLead} extra={navExtra} />
      <main id="main">
        {/* The nav turns to glass once this leaves the screen. */}
        <div id="top" aria-hidden className="absolute top-0 left-0 h-4 w-px" />
        <div className="v94-day relative">
          {children}
          {/* The paper fades into the haze the footer starts on, so the page never meets the
              footer on a hard edge. */}
          <div
            aria-hidden
            className="c-dusk pointer-events-none mt-[clamp(32px,4vw,64px)] h-[clamp(96px,14vw,200px)]"
          />
        </div>
      </main>
      <Footer home={site.url} />
    </>
  )
}
