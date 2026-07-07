import type { ReactNode } from 'react'

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red uppercase">{label}</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
      </div>
      {children}
    </section>
  )
}
