'use client'

// Glass primitives for the Connect dashboard, built from the website's recipes (style guide
// sections 4-5): g-glass for big panels, g-chip for anything small or in a list, smoke ink for
// selected state, orange only as an accent. Every interactive piece keeps a visible focus ring
// and a 40-44px hit target. Use these when restyling the remaining panels.
import { forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'

export {
  FOCUS,
  LABEL,
  SMALL_LABEL,
  TAG,
  CHIP,
  CHIP_ON,
  CHIP_OFF,
  CHIP_ROW,
  ACTION,
  PRIMARY,
  BEAD,
  PANEL,
  CARD,
  ROW,
  ATTN,
  TAG_INK,
  TAG_MUTED,
  TAG_ATTN,
  FIGURE,
  TITLE,
  CARD_TITLE,
  SUB,
  LINK,
  SKELETON,
  LIST,
} from './recipes'
import {
  ACTION,
  ATTN,
  BEAD,
  CARD,
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  FIGURE,
  FOCUS,
  LABEL,
  PRIMARY,
  SMALL_LABEL,
  SUB,
  TITLE,
} from './recipes'
import { StarMark } from '@/components/glass/d/emblem-parts'
import { CountUp } from '@/components/glass/count-up'

/* ── Components ── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

/** The orange call to action. */
export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(function PrimaryButton(
  { className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(PRIMARY, className)} {...rest} />
})

/** A smaller g-chip action. */
export const ActionButton = forwardRef<HTMLButtonElement, ButtonProps>(function ActionButton(
  { className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(ACTION, className)} {...rest} />
})

/** Round icon button; give it an aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(function IconButton(
  { className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(BEAD, className)} {...rest} />
})

/** A toggle chip (aria-pressed). */
export function Chip({ on, className, children, ...rest }: ButtonProps & { on: boolean }) {
  return (
    <button type="button" aria-pressed={on} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, className)} {...rest}>
      {children}
    </button>
  )
}

/** Mono caps label with an optional action on the right, for panel and section headers. */
export function PanelHeader({
  title,
  action,
  className,
  as: Tag = 'h2',
}: {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
  as?: 'h2' | 'h3' | 'p'
}) {
  return (
    <div className={cn('flex min-h-10 items-center justify-between gap-3', className)}>
      <Tag className={LABEL}>{title}</Tag>
      {action}
    </div>
  )
}

/** Text field built from the website's search field: a g-chip pill, 16px text (no iOS zoom),
 *  an optional icon, and a visible or screen-reader label. */
export function Field({
  label,
  hideLabel,
  icon,
  className,
  inputClassName,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hideLabel?: boolean
  icon?: React.ReactNode
  inputClassName?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : cn('mb-2 block', SMALL_LABEL)}>
        {label}
      </label>
      <div className="g-chip flex h-12 items-center gap-3 rounded-full px-5 focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--foreground)]">
        {icon && (
          <span aria-hidden className="shrink-0 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={cn(
            'c-field-input h-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground',
            inputClassName,
          )}
          {...rest}
        />
      </div>
    </div>
  )
}

/** A magnifier, for search fields. */
export function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="7" cy="7" r="4.75" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  )
}

/** Chevron that turns 180deg when open. */
export function Chevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn(
        'size-4 shrink-0 text-muted-foreground transition-[rotate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]',
        open && 'rotate-180',
        className,
      )}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A small pulsing dot while something loads (orange: something is happening). */
export function Loading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2.5 py-12', className)}>
      <span aria-hidden className="size-2 animate-pulse rounded-full bg-[var(--primary)]" />
      <span className={SMALL_LABEL}>{label}</span>
    </div>
  )
}

/* ── Added for the panels (P1 round) ── */

/** Screen-reader note for links that open a new tab (style guide Do 13). */
export function NewTab() {
  return <span className="sr-only"> (opens in a new tab)</span>
}

/** The title block of a dashboard screen: small label, display title, one sub-line, then any
 *  extra lines or actions. Same sizes as the HQ header; centered on phones (style guide 9). */
export function PageHeader({
  eyebrow,
  title,
  sub,
  children,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('max-sm:text-center [&>p]:max-sm:mx-auto', className)}>
      {eyebrow && <p className={SMALL_LABEL}>{eyebrow}</p>}
      <h1 className={cn(TITLE, eyebrow && 'mt-2')}>{title}</h1>
      {sub && <p className={cn('mt-4 max-w-[78ch] text-pretty', SUB)}>{sub}</p>}
      {children}
    </header>
  )
}

/** On/off switch: smoke ink track when on (selected is never orange), a white knob, the state in
 *  words beside it. A real button with role="switch". */
export function Switch({
  on,
  onChange,
  label,
  disabled,
  className,
  title,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(
        'group inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full pr-2 select-none disabled:cursor-not-allowed disabled:opacity-50',
        FOCUS,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-[background-color,box-shadow] duration-200',
          on
            ? 'bg-[var(--foreground)] shadow-[inset_0_1px_2px_oklch(0.2_0.015_240/0.5),0_6px_16px_-8px_oklch(0.3_0.015_240/0.6)]'
            : 'g-chip',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 size-5 rounded-full bg-white shadow-[inset_0_-2px_4px_-1px_oklch(0.3_0.015_240/0.18),0_0_0_1px_oklch(0.3_0.015_240/0.12),0_2px_6px_-1px_oklch(0.3_0.015_240/0.35)] transition-[translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
            on && 'translate-x-5',
          )}
        />
      </span>
      {label !== undefined && <span className="text-[15px] font-medium">{label}</span>}
    </button>
  )
}

/** A native select dressed as the g-chip field (16px, chevron on the right). */
export function Select({
  label,
  hideLabel,
  className,
  selectClassName,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hideLabel?: boolean; selectClassName?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : cn('mb-2 block', SMALL_LABEL)}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={cn(
            'g-chip h-12 w-full cursor-pointer appearance-none rounded-full pr-11 pl-5 text-[16px] text-foreground transition-[background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
            FOCUS,
            selectClassName,
          )}
          {...rest}
        >
          {children}
        </select>
        <Chevron className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2" />
      </div>
    </div>
  )
}

/** A small icon that says "needs attention" (orange ring with a mark). Decorative: pair it with words. */
export function AttentionIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn('size-4 shrink-0', ATTN, className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.8v3.6" />
      <circle cx="8" cy="11" r="0.4" fill="currentColor" />
    </svg>
  )
}

/** A done check in a ring (smoke). Decorative: pair it with words. */
export function DoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn('size-4 shrink-0 text-muted-foreground', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.4 8.2 7.2 10l3.4-3.8" />
    </svg>
  )
}

/** The docs callout: a g-chip card with the orange star (or, when it needs attention, the
 *  attention mark and an orange title). Never a big orange fill. */
export function Callout({
  title,
  attention,
  children,
  actions,
  className,
  role,
}: {
  title?: React.ReactNode
  attention?: boolean
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  role?: 'alert' | 'status' | 'note'
}) {
  return (
    <aside
      role={role}
      className={cn('g-chip flex gap-3.5 rounded-[20px] px-5 py-4 text-[15px] leading-[1.6]', className)}
    >
      {attention ? (
        <AttentionIcon className="mt-[0.3em] size-[1.1em]" />
      ) : (
        <StarMark aria-hidden className="mt-[0.3em] h-[1.1em] w-auto shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-semibold', attention && ATTN)}>{title}</p>}
        {children && <div className={cn('text-[var(--g-ink-soft)]', title && 'mt-1')}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </aside>
  )
}

/** Numbers as chip cards that count up on first view (the HQ stat grid). */
export function Stats({
  items,
  label = 'Numbers',
  className,
}: {
  items: { label: string; value: number; attention?: boolean }[]
  label?: string
  className?: string
}) {
  return (
    <dl aria-label={label} className={cn('grid grid-cols-2 gap-2.5 lg:grid-cols-4', className)}>
      {items.map((s, i) => (
        <div key={s.label} className={cn(CARD, 'flex flex-col-reverse gap-2.5 px-5 py-5')}>
          <dt className="text-[15px] leading-[1.35] text-muted-foreground">{s.label}</dt>
          <dd className={cn(FIGURE, s.attention && ATTN)}>
            <CountUp to={s.value} delay={i * 0.12} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Nothing here yet: a calm title and one hint line. */
export function EmptyState({
  title,
  hint,
  className,
  children,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('px-6 py-12 text-center', className)}>
      <p className="font-display text-[1.375rem] leading-[1.2] font-light tracking-[-0.02em]">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-[1.5] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

/** A small number field for times and intervals (16px, centered). */
export const NumberField = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function NumberField({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        className={cn(
          'g-chip h-10 w-16 shrink-0 rounded-full px-2 text-center font-mono text-[16px] text-foreground tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          FOCUS,
          className,
        )}
        {...rest}
      />
    )
  },
)
