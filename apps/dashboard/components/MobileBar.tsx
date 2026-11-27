'use client'

import { ActionButton, IconButton } from './glass/connect/ui'

// Phone-only bar (hidden from `md` up, where the sidebar column, the nav and the
// activity column carry the same controls): opens the sidebar drawer, shows the
// current screen's title, and opens the Feed / Runs / Analytics drawer.
export function MobileBar({
  title,
  onOpenNav,
  onOpenActivity,
}: {
  title: string
  onOpenNav: () => void
  onOpenActivity: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-2 md:hidden">
      {/* A labeled pill with a list glyph, so it never reads as a second copy of the site menu. */}
      <ActionButton onClick={onOpenNav} aria-label="Open skills list" className="h-11 shrink-0 gap-2 px-4">
        <svg
          viewBox="0 0 16 16"
          className="size-4"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5" />
          <circle cx="2.75" cy="4.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="2.75" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="2.75" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
        Skills
      </ActionButton>
      <span className="g-chip inline-flex h-11 min-w-0 max-w-[60vw] items-center rounded-full px-4 font-display text-[15px] tracking-[-0.01em]">
        <span className="truncate">{title}</span>
      </span>
      <IconButton
        onClick={onOpenActivity}
        aria-label="Open feed, runs and analytics"
        title="Activity"
        className="size-11"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-[18px]"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 8h3l2 5 3-10 2 5h3" />
        </svg>
      </IconButton>
    </div>
  )
}
