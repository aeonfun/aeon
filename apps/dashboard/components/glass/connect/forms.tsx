'use client'

// Form pieces for the Connect dashboard, next to Field, Select and the rest in ./ui.tsx (and
// ui/CommandBox for commands): a multi-line field, numbered step labels, a status line (icon + word,
// never color alone), an external text link and the one segmented choice (radio chips). All on paper: g-chip
// surfaces, 16px inputs, smoke ink for selected, orange only for "needs attention".
import { useId } from 'react'
import { cn } from '@/lib/cn'
import { ArrowUpRightLightIcon } from '../d/icons'
import { CHIP, CHIP_OFF, CHIP_ON, FOCUS, LINK, SMALL_LABEL } from './recipes'
import { TEXTAREA } from './form-recipes'

export { TEXTAREA, EDITOR, RADIO, CHECKBOX, CHOICE_ROW, BODY, HINT, INLINE_CODE, QUIET_TAG } from './form-recipes'

/** A label above a field: the small mono caps with an optional plain hint after it. */
export function FieldLabel({
  htmlFor,
  children,
  hint,
  className,
}: {
  htmlFor?: string
  children: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-2 block', className)}>
      <span className={SMALL_LABEL}>{children}</span>
      {hint && <span className="mt-1 block text-[13px] leading-[1.45] text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Multi-line field with a visible (or screen-reader) label. */
export function TextArea({
  label,
  hint,
  hideLabel,
  className,
  textareaClassName,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: React.ReactNode
  hideLabel?: boolean
  textareaClassName?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      {hideLabel ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : (
        <FieldLabel htmlFor={id} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <textarea id={id} className={cn(TEXTAREA, textareaClassName)} {...rest} />
    </div>
  )
}

/** A numbered step: the orange step bead and a plain label. */
export function StepLabel({ n, children, className }: { n: number; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mb-3 flex items-center gap-3', className)}>
      <span
        aria-hidden
        className="c-bead grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold text-[var(--primary-foreground)]"
      >
        {n}
      </span>
      <span className="text-[15px] font-medium text-foreground">
        <span className="sr-only">Step {n}: </span>
        {children}
      </span>
    </p>
  )
}

export type NoteTone = 'ok' | 'error' | 'warn' | 'info' | 'busy'

/** A status line, never color alone: ok = check + smoke, error = X + deep orange, warn = ! + deep
 *  orange, info = i + smoke, busy = a pulsing dot. */
export function StatusNote({
  tone,
  children,
  className,
  live = true,
}: {
  tone: NoteTone
  children: React.ReactNode
  className?: string
  live?: boolean
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      aria-live={live && tone !== 'error' ? 'polite' : undefined}
      className={cn(
        'flex items-start gap-2 text-[14px] leading-[1.5]',
        tone === 'error' || tone === 'warn' ? 'text-[oklch(0.5_0.19_33)]' : 'text-[var(--g-ink-soft)]',
        className,
      )}
    >
      <NoteIcon tone={tone} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  )
}

function NoteIcon({ tone }: { tone: NoteTone }) {
  const cls = 'mt-[3px] size-4 shrink-0'
  if (tone === 'busy')
    return (
      <span
        aria-hidden
        className="mt-[7px] ml-1 size-2 shrink-0 animate-pulse rounded-full bg-[var(--primary)] motion-reduce:animate-none"
      />
    )
  if (tone === 'error')
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={cn(cls, 'text-[oklch(0.55_0.2_33)]')} fill="currentColor">
        <circle cx="8" cy="8" r="7" />
        <path
          d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
          stroke="oklch(0.985 0.004 220)"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </svg>
    )
  if (tone === 'warn')
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cn(cls, 'text-[oklch(0.55_0.2_33)]')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.8v4M8 11.2v.01" />
      </svg>
    )
  if (tone === 'ok')
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cn(cls, 'text-foreground')}
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
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn(cls, 'text-muted-foreground')}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.2v3.6M8 5.2v.01" />
    </svg>
  )
}

/** An external link in running text: underlined, with the arrow and a screen-reader note. */
export function ExternalLink({
  href,
  children,
  className,
  title,
}: {
  href: string
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(LINK, 'inline-flex items-center gap-1', className)}
    >
      {children}
      <ArrowUpRightLightIcon className="size-3.5 shrink-0 opacity-70" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** A small set of options as chips (a radio group: arrow keys move, one is picked). */
export function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  chipClassName,
  variant = 'chips',
}: {
  label: string
  value: T
  options: readonly { id: T; label: React.ReactNode }[]
  onChange: (v: T) => void
  className?: string
  chipClassName?: string
  /** chips = separate chips that wrap; group = one connected pill (m / h, AM / PM, http / stdio). */
  variant?: 'chips' | 'group'
}) {
  const group = variant === 'group'
  const move = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = options[(i + step + options.length) % options.length]
    onChange(next.id)
    const row = e.currentTarget.parentElement
    requestAnimationFrame(() => row?.querySelector<HTMLButtonElement>(`[data-choice="${next.id}"]`)?.focus())
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(group ? 'g-chip inline-flex shrink-0 rounded-full p-1' : 'flex flex-wrap gap-1.5', className)}
    >
      {options.map((o, i) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-choice={o.id}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={e => move(e, i)}
            className={cn(
              group
                ? cn(
                    'h-8 min-w-10 cursor-pointer rounded-full px-3 font-mono text-[12px] font-medium tracking-[0.08em] uppercase transition-[background-color,color] duration-150',
                    on ? CHIP_ON : 'text-muted-foreground hover:text-foreground',
                    FOCUS,
                  )
                : cn(CHIP, on ? CHIP_ON : CHIP_OFF),
              chipClassName,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** One choice in a template picker: a chip card with a title and a short line. */
export function TemplateCard({ title, blurb, onPick }: { title: string; blurb?: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'g-chip flex w-full cursor-pointer flex-col items-start gap-1 rounded-[18px] px-4 py-3.5 text-left transition-[background-color] duration-150',
        FOCUS,
      )}
    >
      <span className="text-[15px] font-medium">{title}</span>
      {blurb && <span className="text-[13.5px] leading-[1.45] text-muted-foreground">{blurb}</span>}
    </button>
  )
}
