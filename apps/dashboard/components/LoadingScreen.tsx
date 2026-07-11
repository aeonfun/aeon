export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-aeon-bg relative overflow-hidden">
      <div className="dither" aria-hidden="true" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-dashed border-aeon-rule animate-aeon-spin" aria-hidden="true" />
          <span className="brand-mark" style={{ width: 72, height: 72 }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/android-chrome-192x192.png" alt="" />
          </span>
        </div>
        <div className="text-center space-y-1">
          <p className="font-display text-2xl uppercase tracking-wide text-aeon-fg">AEON HQ</p>
          <p className="text-[11px] text-aeon-red font-mono uppercase tracking-[0.28em] animate-shimmer">Initializing</p>
        </div>
        <div className="w-40 h-[2px] bg-[rgba(250,250,250,0.08)] overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-aeon-red to-transparent bg-[length:200%_100%] animate-shimmer-gradient" />
        </div>
      </div>
    </div>
  )
}
