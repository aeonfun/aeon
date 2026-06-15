'use client'

import { useRef } from 'react'
import type { Skill, Run } from '../lib/types'
import { PACKS } from '../lib/constants'
import { timeAgo } from '../lib/utils'
import { Scramble, Flip, VelocityMarquee } from './ui/Animated'

interface HQOverviewProps {
  skills: Skill[]
  runs: Run[]
  enabledCount: number
  workingCount: number
  categoryFilter: string | null
  onCategoryClick: (key: string) => void
  onViewRun: (run: Run) => void
}

function Section({ index, label, children }: { index: string; label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">{index} / {label}</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
      </div>
      {children}
    </section>
  )
}

export function HQOverview({ skills, runs, enabledCount, workingCount, categoryFilter, onCategoryClick, onViewRun }: HQOverviewProps) {
  const spotRef = useRef<HTMLUListElement>(null)

  const onMove = (e: React.MouseEvent<HTMLUListElement>) => {
    const card = (e.target as HTMLElement).closest('li')
    if (!card) return
    const r = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - r.left}px`)
    card.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  const cats = PACKS
    .map(c => ({ ...c, skills: skills.filter(s => (s.pack || 'lab') === c.key) }))
    .filter(c => c.skills.length)

  const stats: { label: string; value: number; tone?: string }[] = [
    { label: 'Team', value: skills.length },
    { label: 'On duty', value: enabledCount, tone: 'text-eva-green' },
    { label: 'Working', value: workingCount, tone: 'text-eva-orange' },
    { label: 'Packs', value: cats.length },
  ]

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-10">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
              <span className="w-7 h-px bg-aeon-red" /> Operations · Live
            </span>
          </div>
          <h1 className="font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(48px, 8vw, 110px)' }}>
            <Scramble text="AEON" />{' '}
            <span className="text-aeon-red"><Scramble text="HQ" delay={180} /></span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            {enabledCount} skill{enabledCount === 1 ? '' : 's'} on duty across {cats.length} pack{cats.length === 1 ? '' : 's'}. {workingCount > 0 ? `${workingCount} currently working.` : 'Idle - waiting for the next cron tick.'}
          </p>
        </div>

        {/* Stats strip - large editorial counters */}
        <dl className="relative z-10 grid grid-cols-2 sm:grid-cols-4 border-t border-[rgba(250,250,250,0.10)]">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-5 ${i < stats.length - 1 ? 'border-r border-[rgba(250,250,250,0.10)]' : ''}`}
            >
              <dt className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary-35 mb-2">{s.label}</dt>
              <dd className={`font-display leading-none ${s.tone || 'text-aeon-fg'}`} style={{ fontSize: 'clamp(32px, 3.5vw, 52px)' }}>
                <Flip value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Section index="01" label="Packs">
        <ul
          ref={spotRef}
          onMouseMove={onMove}
          className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[rgba(250,250,250,0.10)] border border-[rgba(250,250,250,0.10)]"
        >
          {cats.map(cat => {
            const en = cat.skills.filter(s => s.enabled).length
            const active = categoryFilter === cat.key
            // li is flex so the button stretches to the grid row's full height —
            // otherwise the active ring stops short when the row neighbor is taller
            return (
              <li key={cat.key} className="spotlight relative overflow-hidden bg-aeon-bg transition-colors hover:bg-aeon-panel-2 flex">
                <button
                  onClick={() => onCategoryClick(cat.key)}
                  title={active ? 'Clear the team filter' : `Filter the team to ${cat.label}`}
                  aria-pressed={active}
                  className="w-full px-6 py-5 flex items-center gap-5 text-left cursor-pointer"
                  style={active ? { boxShadow: `inset 0 0 0 1px ${cat.color}`, backgroundColor: cat.color + '14' } : undefined}
                >
                  <span className="font-display leading-none text-aeon-red shrink-0 whitespace-nowrap" style={{ fontSize: 'clamp(28px, 3vw, 44px)' }}>
                    <Flip value={cat.skills.length} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display uppercase tracking-wide text-aeon-fg text-base leading-tight">{cat.label}</div>
                    <div className="text-[11px] text-primary-40 font-mono mt-1 uppercase tracking-[0.14em]">{en} active · {cat.skills.length - en} idle</div>
                  </div>
                  <span
                    className="ml-auto w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active || en > 0 ? cat.color : 'rgba(250,250,250,0.15)' }}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section index="02" label="Recent activity">
        <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
          {runs.slice(0, 8).map(run => (
            <button
              key={run.id}
              onClick={() => onViewRun(run)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-aeon-panel transition-colors text-left group"
            >
              <span className={`text-sm w-4 shrink-0 ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                {run.conclusion === 'success' ? '✓' : run.conclusion === 'failure' ? '✗' : run.status === 'in_progress' ? '◌' : '·'}
              </span>
              <span className="text-xs text-primary-70 truncate flex-1 font-mono group-hover:text-aeon-fg transition-colors">{run.workflow}</span>
              <span className="text-[10px] text-primary-35 font-mono tabular-nums uppercase tracking-[0.14em]">{timeAgo(run.created_at)}</span>
            </button>
          ))}
          {!runs.length && (
            <div className="px-6 py-12 text-center">
              <p className="font-display uppercase text-aeon-fg text-xl tracking-wide">Nothing yet</p>
              <p className="text-[11px] text-primary-40 font-mono mt-2 uppercase tracking-[0.18em]">The fleet is waiting for its first run</p>
            </div>
          )}
        </div>
      </Section>

      <VelocityMarquee
        className="overflow-hidden border-y border-aeon-fg/30 whitespace-nowrap py-3 font-display uppercase tracking-wide text-base text-aeon-fg/85"
        trackClassName="inline-block will-change-transform"
      >
        {Array.from({ length: 2 }).map((_, k) => (
          <span key={k} aria-hidden={k === 1 ? 'true' : undefined} className="inline-block px-7">
            AEON HQ <i className="not-italic text-aeon-red">★</i> {enabledCount} ON DUTY <i className="not-italic text-aeon-red">★</i> {cats.length} PACKS <i className="not-italic text-aeon-red">★</i> {runs.length} RUNS LOGGED <i className="not-italic text-aeon-red">★</i> NO BABYSITTING <i className="not-italic text-aeon-red">★</i>
          </span>
        ))}
      </VelocityMarquee>
    </div>
  )
}
