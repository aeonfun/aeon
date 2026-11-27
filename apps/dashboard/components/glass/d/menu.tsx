'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useEffect, useRef } from 'react'

import { LogoGithubIcon, LogoXIcon } from '@/components/glass/d/icons'
import { usePrefersReducedMotion } from '@/components/glass/d/use-reduced-motion'
import { site } from '@/content/d-site'
import { cn } from '@/lib/cn'

const menu = site.menu
// Where the desktop rows break (3, 2, 3), so the field sits off-kilter, not as a grid.
const BREAKS = new Set(menu.rows.slice(0, -1).map((_, r) => menu.rows.slice(0, r + 1).reduce((a, b) => a + b, 0)))

/** The toggle: two strokes that cross into an X while the menu is open. */
export function MenuToggle({
  open,
  onClick,
  ref,
}: {
  open: boolean
  onClick: () => void
  ref?: React.Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={open ? site.ui.closeMenu : site.ui.openMenu}
      aria-expanded={open}
      aria-controls="d-menu"
      className="g-bead relative grid size-11 cursor-pointer place-items-center rounded-full text-foreground transition-[scale] duration-150 active:scale-[0.96]"
    >
      {[-1, 1].map(side => (
        <span
          key={side}
          aria-hidden
          className="absolute h-[1.5px] w-[18px] rounded-full bg-current transition-[translate,rotate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            translate: open ? '0 0' : `0 ${side * 4}px`,
            rotate: open ? `${side * 45}deg` : '0deg',
          }}
        />
      ))}
    </button>
  )
}

/** X and the source, two small bubbles that slide in beside the toggle while the menu is open. */
export function MenuActions({ open }: { open: boolean }) {
  const links = [
    { ...site.social.x, Icon: LogoXIcon },
    { ...site.social.github, Icon: LogoGithubIcon, count: undefined },
  ]
  return (
    <AnimatePresence>
      {open &&
        links.map(({ label, href, Icon, count }, i) => (
          <motion.a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} (${site.ui.external})`}
            initial={{ opacity: 0, x: 10, scale: 0.85 }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
              transition: {
                delay: 0.05 * (links.length - i),
                duration: 0.28,
                ease: [0.23, 1, 0.32, 1],
              },
            }}
            exit={{
              opacity: 0,
              x: 10,
              scale: 0.85,
              transition: { duration: 0.15 },
            }}
            className={cn(
              'g-bead hidden h-11 rounded-full text-foreground',
              count ? 'items-center gap-1.5 px-4 sm:flex' : 'w-11 place-items-center sm:grid',
            )}
          >
            <Icon className="size-[18px]" />
            {count && <span className="text-[14px] font-medium tabular-nums">{count}</span>}
          </motion.a>
        ))}
    </AnimatePresence>
  )
}

/** The menu, ported from the live site: smoked glass closes in behind a field of glass pills, each
 *  tilted a little and set in the display face; they pop in one after another, and the one under
 *  the pointer takes the star's orange. A click on the night, Escape or a link closes it; Tab
 *  stays inside it and the nav while it is open. Phones get one column on a deeper night. */
export function MenuOverlay({
  open,
  onClose,
  navRef,
}: {
  open: boolean
  onClose: () => void
  navRef: React.RefObject<HTMLElement | null>
}) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true })

    // The page behind goes inert while the menu is open: every sibling of the nav's header and of
    // its ancestors, up to <body>, except the overlay itself. Screen readers and Tab skip it.
    const header = navRef.current?.closest('header') ?? navRef.current
    const keep = [header, ref.current]
    const muted: HTMLElement[] = []
    for (let node: HTMLElement | null | undefined = header; node && node !== document.body; node = node.parentElement) {
      for (const sib of node.parentElement?.children ?? []) {
        if (!(sib instanceof HTMLElement) || sib === node || keep.some(k => k && sib.contains(k)) || sib.inert) continue
        if (sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE') continue
        sib.setAttribute('inert', '')
        muted.push(sib)
      }
    }

    // Only what can take focus right now: shown at this width, not inert, not tabIndex -1.
    const focusable = (el: HTMLElement) =>
      el.tabIndex >= 0 &&
      !el.closest("[inert], [aria-hidden='true']") &&
      (typeof el.checkVisibility === 'function'
        ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
        : el.getClientRects().length > 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      const all = [navRef.current, ref.current]
        .flatMap(el => (el ? [...el.querySelectorAll<HTMLElement>('a[href], button')] : []))
        .filter(focusable)
      if (!all.length) return
      const i = all.indexOf(document.activeElement as HTMLElement)
      const next =
        i < 0 ? all[e.shiftKey ? all.length - 1 : 0] : all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length]
      e.preventDefault()
      next.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      for (const el of muted) el.removeAttribute('inert')
    }
  }, [open, onClose, navRef])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id="d-menu"
          key="menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.1 } }}
          onClick={e => {
            if (!(e.target as HTMLElement).closest('a')) onClose()
          }}
          className="g-menu fixed inset-0 z-30 flex flex-col overflow-y-auto overscroll-contain px-5 pt-24 pb-10 min-[900px]:items-center min-[900px]:justify-center min-[900px]:px-[clamp(24px,4vw,64px)] min-[900px]:py-24"
        >
          <nav aria-label={site.ui.menuPages} className="my-auto w-full max-w-[1400px]">
            <ul className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:flex-wrap min-[900px]:justify-center min-[900px]:gap-x-0 min-[900px]:gap-y-[clamp(8px,1.4vw,20px)]">
              {menu.items.map((item, i) => (
                <Fragment key={item.href}>
                  {BREAKS.has(i) && <li aria-hidden className="hidden basis-full min-[900px]:block" />}
                  <li className="min-[900px]:basis-1/3 min-[900px]:px-[clamp(8px,1.2vw,20px)]">
                    <motion.a
                      href={item.href}
                      aria-label={'aria' in item ? item.aria : undefined}
                      onClick={onClose}
                      initial={reduced ? false : { scale: 0 }}
                      animate={{
                        scale: 1,
                        transition: {
                          type: 'spring',
                          bounce: 0.4,
                          duration: 0.55,
                          delay: reduced ? 0 : i * 0.07,
                        },
                      }}
                      exit={{
                        scale: reduced ? 1 : 0,
                        transition: { duration: 0.18, ease: 'easeIn' },
                      }}
                      style={{ '--tilt': `${item.tilt}deg` } as React.CSSProperties}
                      className={cn(
                        // Each pill is a bead of clear glass with smoke ink; under the pointer it fills
                        // with the star's orange, lit from inside (skin.css .g-menu-pill).
                        'g-menu-pill group flex h-[clamp(72px,16vw,96px)] items-center justify-center rounded-full outline-none',
                        'min-[900px]:h-[clamp(96px,8.4vw,132px)] min-[900px]:rotate-[var(--tilt)]',
                      )}
                    >
                      <motion.span
                        initial={reduced ? false : { y: 24, opacity: 0 }}
                        animate={{
                          y: 0,
                          opacity: 1,
                          transition: {
                            duration: 0.5,
                            ease: [0.23, 1, 0.32, 1],
                            delay: reduced ? 0 : i * 0.07 + 0.05,
                          },
                        }}
                        exit={{
                          y: reduced ? 0 : 24,
                          opacity: 0,
                          transition: { duration: 0.15 },
                        }}
                        className="block font-display text-[clamp(2rem,8vw,2.75rem)] leading-none font-light tracking-[-0.03em] italic transition-[scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.06] min-[900px]:text-[clamp(2.25rem,3.6vw,3.75rem)]"
                      >
                        {item.label}
                      </motion.span>
                    </motion.a>
                  </li>
                </Fragment>
              ))}
            </ul>
          </nav>
          {/* On phones the two small bubbles leave the nav, so X and the source sit under the pills. */}
          <div className="mt-8 flex justify-center gap-3 sm:hidden">
            {[
              { ...site.social.x, Icon: LogoXIcon },
              { ...site.social.github, Icon: LogoGithubIcon, count: undefined },
            ].map(({ label, href, Icon, count }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} (${site.ui.external})`}
                className={cn(
                  'g-bead flex h-12 items-center justify-center rounded-full text-foreground',
                  count ? 'gap-2 px-5' : 'w-12',
                )}
              >
                <Icon className="size-5" />
                {count && <span className="text-[15px] font-medium tabular-nums">{count}</span>}
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
