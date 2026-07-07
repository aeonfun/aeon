'use client'

// Shown when a panel's lazy data fetch fails, in place of an indefinite
// spinner. Surfaces the failure and offers a retry instead of hiding it.
export function PanelError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="text-sm text-eva-red font-mono">Couldn&apos;t load {label}</div>
      <div className="text-[11px] text-primary-35 font-mono">The request failed - check your connection and retry.</div>
      <button
        onClick={onRetry}
        className="cursor-target bg-aeon-bg text-primary-70 text-[11px] px-4 py-2 font-mono uppercase tracking-[1px] border border-[rgba(250,250,250,0.10)] hover:border-eva-orange hover:text-eva-orange transition-colors"
      >Retry</button>
    </div>
  )
}
