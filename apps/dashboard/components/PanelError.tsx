'use client'

import { ActionButton } from './glass/connect/ui'
import { RunIcon } from './glass/connect/run-status'

// Shown when a panel's lazy data fetch fails, in place of an indefinite
// spinner. Surfaces the failure and offers a retry instead of hiding it.
// The failure is said in words with the failed icon, never by color alone.
export function PanelError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="g-chip grid size-12 place-items-center rounded-full">
        <RunIcon state="failed" className="size-5" />
      </span>
      <p className="mt-1 font-display text-[1.375rem] leading-[1.2] font-light tracking-[-0.02em]">
        Couldn&apos;t load {label}
      </p>
      <p className="max-w-[40ch] text-[15px] leading-[1.5] text-muted-foreground">
        The request failed. Check your connection and retry.
      </p>
      <ActionButton onClick={onRetry} className="mt-2">
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 8a5 5 0 1 1-1.46-3.54" />
          <path d="M13 2.5v3h-3" />
        </svg>
        Retry
      </ActionButton>
    </div>
  )
}
