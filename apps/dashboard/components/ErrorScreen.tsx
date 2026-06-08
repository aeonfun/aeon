export function ErrorScreen({ error }: { error: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-aeon-bg relative overflow-hidden">
      <div className="dither" aria-hidden="true" />
      <div className="relative z-10 max-w-sm card-hst p-[var(--space-lg)] text-center">
        <p className="font-display text-2xl uppercase tracking-wide text-aeon-red mb-2">Connection Lost</p>
        <div className="warning-stripes my-4" />
        <p className="text-xs text-primary-50 font-mono">{error}</p>
      </div>
    </div>
  )
}
