'use client'

// The shell every dashboard dialog shares: a soft smoke backdrop, a glass sheet (like the docs
// search dialog), a plain title and a round close button. Only the frame lives here; each modal
// keeps its own body. `dismissible` lets a click on the backdrop and Escape close it, for the
// dialogs that allowed that before (Connect does not, so a half-done sign-in is not lost).
import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { BEAD } from './recipes'
import { useFocusTrap } from './use-focus-trap'

export function GlassModal({
  title,
  label,
  onClose,
  dismissible = true,
  width = 'max-w-lg',
  children,
}: {
  title: React.ReactNode
  /** Accessible name when the title is not plain text. */
  label?: string
  onClose: () => void
  dismissible?: boolean
  width?: string
  children: React.ReactNode
}) {
  const sheet = useRef<HTMLDivElement>(null)

  // Focus lands inside, Tab stays inside, Escape closes (when dismissible), focus returns after.
  useFocusTrap(sheet, true, dismissible ? onClose : undefined)

  return (
    <div
      className="c-modal-backdrop g-dawn fixed inset-0 z-[110] flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={cn('g-glass c-modal c-solid relative my-auto w-full rounded-[24px] outline-none', width)}
      >
        <div className="relative z-[1] max-h-[calc(100dvh-24px)] overflow-y-auto px-5 pt-4 pb-6 sm:max-h-[min(92vh,880px)] sm:px-8 sm:pt-6 sm:pb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-[clamp(1.5rem,2.4vw,1.75rem)] leading-[1.15] font-light tracking-[-0.025em]">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className={BEAD}>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
