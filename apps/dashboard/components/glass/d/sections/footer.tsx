import { LogoGithubIcon, LogoXIcon } from '@/components/glass/d/icons'
import { TextLink } from '@/components/glass/d/link-button'
import { MetalMark } from '@/components/glass/d/metal-mark'
import { Starred } from '@/components/glass/d/starred'
import { site } from '@/content/d-site'
import { cn } from '@/lib/cn'

const footer = site.sections.footer

const social = [
  { ...site.social.x, Icon: LogoXIcon },
  { ...site.social.github, Icon: LogoGithubIcon, count: undefined },
]

export function Footer({ home = '#top' }: { home?: string } = {}) {
  return (
    <footer className="g-footer px-3 pb-3 sm:px-4 sm:pb-4">
      {/* One big slab of frosted glass over the last of the dawn, its rim catching the light. */}
      <div className="g-slab mx-auto max-w-[1400px] rounded-[28px] px-6 pt-9 pb-7 sm:rounded-[36px] sm:px-10 sm:pt-16 sm:pb-10 lg:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:gap-12 md:grid-cols-[1.3fr_2fr]">
            <div>
              <a
                href={home}
                aria-label={site.ui.home}
                className="d-turn inline-flex h-11 items-center gap-3 rounded-full"
              >
                <MetalMark className="size-10" />
                <span className="font-display text-[2rem] leading-none tracking-[-0.02em] italic">{site.name}</span>
              </a>
              {/* The idea, signed off: the name's tagline and the line it stands for. */}
              <p className="mt-3 max-w-[30ch] text-[15px] sm:mt-4 leading-[1.6] text-muted-foreground">
                <span className="block text-foreground">{site.tagline}</span>
                {footer.signoff ?? site.sections.finalCta.headline.join(' ')}
              </p>
              <ul className="mt-4 flex gap-2 sm:mt-6">
                {social.map(({ label, href, Icon, count }) => (
                  <li key={href}>
                    <TextLink
                      href={href}
                      aria-label={`${label} (${site.ui.external})`}
                      className={cn(
                        'g-bead flex h-11 items-center justify-center rounded-full',
                        count ? 'gap-1.5 px-4' : 'w-11',
                      )}
                    >
                      <Icon className="size-[18px]" />
                      {count && <span className="text-[14px] font-medium tabular-nums">{count}</span>}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </div>
            <nav aria-label={site.ui.footerNav} className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-8">
              {footer.columns.map(col => (
                <div key={col.title}>
                  <h2 className="font-mono text-[12px] font-medium sm:text-[13px] tracking-[0.1em] text-muted-foreground uppercase">
                    {col.title}
                  </h2>
                  <ul className="mt-2 sm:mt-3">
                    {col.links.map(l => (
                      <li key={l.href}>
                        {/* TextLink: an outside link (Run Aeon, on Connect) opens a new tab, as from the nav. */}
                        <TextLink
                          href={l.href}
                          className="-mx-2 inline-flex min-h-9 items-center rounded-lg px-2 text-[14px] transition-[color] sm:min-h-11 sm:text-[15px] duration-150 hover:text-muted-foreground"
                        >
                          <Starred text={l.label} />
                        </TextLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
          <div className="mt-8 border-t border-[var(--line)] pt-5 text-[14px] text-muted-foreground sm:mt-16 sm:pt-6">
            <p>{footer.legal}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
