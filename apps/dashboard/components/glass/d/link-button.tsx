'use client'

// Client side of the boundary: the fluid Button clones its asChild <a>, which a
// server-sent element cannot be (it arrives lazy and would hydrate as a <button>).
import { site } from '@/content/d-site'
import { Button } from '@/components/glass/d/ui/button'
import { cn } from '@/lib/cn'

const tones = {
  // Star orange fill, deep violet ink: the fluid primary reads --foreground as its fill
  // and --background as its label, so remap both on the element.
  primary:
    '[--foreground:var(--primary)] [--background:var(--primary-foreground)] text-[var(--primary-foreground)] font-semibold',
  secondary: 'font-medium',
  outline: 'font-medium',
} as const

const variants = { primary: 'primary', secondary: 'secondary', outline: 'tertiary' } as const

export function isExternal(href: string) {
  return /^https?:\/\//.test(href)
}

export function LinkButton({
  href,
  children,
  tone = 'primary',
  className,
  sameTab = false,
  ...rest
}: {
  href: string
  children: React.ReactNode
  tone?: keyof typeof tones
  className?: string
  /** Connect: a full www.aeon.fun URL is the same site, so it opens in this tab. */
  sameTab?: boolean
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>) {
  const external = !sameTab && isExternal(href)
  return (
    <Button
      asChild
      variant={variants[tone]}
      className={cn(
        'h-11 gap-2 rounded-full px-6 text-[15px] whitespace-nowrap active:scale-[0.97] transition-[scale,color] duration-150 [&>span>span]:inline-flex [&>span>span]:items-center [&>span>span]:gap-2',
        tones[tone],
        className,
      )}
    >
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
        {external ? <span className="sr-only"> ({site.ui.external})</span> : null}
      </a>
    </Button>
  )
}

// Plain text link with the same external handling, for lists and footers.
export function TextLink({
  href,
  children,
  className,
  ...rest
}: {
  href: string
  children: React.ReactNode
  className?: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>) {
  const external = isExternal(href)
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
      {external ? <span className="sr-only"> ({site.ui.external})</span> : null}
    </a>
  )
}
