'use client'

// Phone-only header (hidden from `md` up, where the sidebar, the TopBar title
// and the right panel are always on screen): opens the sidebar drawer, shows
// the current screen's title, and opens the Feed / Runs / Analytics drawer.
export function MobileBar({ title, onOpenNav, onOpenActivity }: {
  title: string
  onOpenNav: () => void
  onOpenActivity: () => void
}) {
  return (
    <div className="md:hidden h-14 border-b border-[rgba(250,250,250,0.10)] flex items-center gap-2 px-3 shrink-0 bg-aeon-bg">
      <button onClick={onOpenNav} aria-label="Open navigation" title="Navigation" className="btn-quiet h-10 w-10 !p-0 shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <span className="font-display text-lg uppercase tracking-wide text-aeon-fg truncate min-w-0 flex-1">{title}</span>
      <button onClick={onOpenActivity} aria-label="Open feed, runs and analytics" title="Activity" className="btn-quiet h-10 w-10 !p-0 shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
          <path d="M3 12h4l3 8 4-16 3 8h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
