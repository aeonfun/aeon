'use client'

import type { Skill, Run } from '../lib/types'
import { packGroups } from '../lib/constants'
import { RunDiagnosisToggle } from './RunDiagnosis'
import { CountUp } from './glass/count-up'
import { RunRow, runState } from './glass/connect/run-status'
import { EmptyState, FIGURE, FOCUS, PageHeader, PanelHeader, Stats } from './glass/connect/ui'
import { cn } from '@/lib/cn'

interface HQOverviewProps {
  // Setup checklist card, rendered above everything until setup is complete.
  checklist?: React.ReactNode
  skills: Skill[]
  runs: Run[]
  // owner/name of the linked repo; the title shows its name when given.
  repo?: string
  enabledCount: number
  workingCount: number
  categoryFilter: string | null
  onCategoryClick: (key: string) => void
  // Opens a run's detail. Without it the rows are plain (not clickable).
  onViewRun?: (run: Run) => void
  onOpenPacks: () => void
  // A failed run's credential problem: open Connect for the run's harness.
  onConnect?: (harness?: string) => void
}

// HQ: the repo's name + HQ and one line on what it is doing, its numbers (counting up on first
// view), the packs as cards that filter the sidebar, and the latest runs.
export function HQOverview({
  skills,
  runs,
  repo,
  enabledCount,
  workingCount,
  categoryFilter,
  onCategoryClick,
  onViewRun,
  onOpenPacks,
  checklist,
  onConnect,
}: HQOverviewProps) {
  // The title carries the connected repo's name, not a generic brand.
  const name = repo?.split('/').pop()
  const repoName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Aeon'

  const cats = packGroups(skills)
    .map(c => ({ ...c, skills: skills.filter(s => (s.pack || 'lab') === c.key) }))
    .filter(c => c.skills.length)

  const failed = runs.filter(r => runState(r) === 'failed').length
  const stats: { label: string; value: number; attention?: boolean }[] = [
    { label: 'Skills', value: skills.length },
    { label: 'Enabled', value: enabledCount },
    { label: 'Working now', value: workingCount, attention: workingCount > 0 },
    { label: 'Packs', value: cats.length },
  ]

  return (
    <div className="space-y-[clamp(36px,4vw,56px)]">
      <PageHeader
        title={`${repoName} HQ`}
        sub={
          <>
            {enabledCount} skill{enabledCount === 1 ? '' : 's'} enabled across {cats.length} pack
            {cats.length === 1 ? '' : 's'}.{workingCount > 0 ? ` ${workingCount} working now.` : ''}
            {failed > 0 ? ` ${failed} recent run${failed === 1 ? '' : 's'} failed.` : ''}
          </>
        }
      />

      {checklist}

      {/* The numbers */}
      <section aria-labelledby="hq-numbers">
        <h2 id="hq-numbers" className="sr-only">
          Numbers
        </h2>
        <Stats items={stats} label="Numbers" />
      </section>

      {/* Packs: each one filters the sidebar to its skills */}
      <section aria-labelledby="hq-packs">
        <PanelHeader title={<span id="hq-packs">Packs</span>} />
        <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cats.map(cat => {
            const en = cat.skills.filter(s => s.enabled).length
            const active = categoryFilter === cat.key
            return (
              <li key={cat.key} className="flex">
                <button
                  type="button"
                  onClick={() => onCategoryClick(cat.key)}
                  title={active ? 'Clear the skills filter' : `Show only ${cat.label} skills in the sidebar`}
                  aria-pressed={active}
                  className={cn(
                    'group flex w-full cursor-pointer items-center gap-5 rounded-[22px] px-5 py-4 text-left transition-[background-color,color,box-shadow] duration-150',
                    active
                      ? 'bg-[var(--foreground)] text-[var(--g-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-8px_oklch(0.3_0.015_240/0.6)]'
                      : 'g-chip',
                    FOCUS,
                  )}
                >
                  <span className={cn(FIGURE, 'w-[2.2ch] shrink-0 text-[clamp(2rem,3vw,2.75rem)]')}>
                    <CountUp to={cat.skills.length} duration={1.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[1.1875rem] leading-[1.3] font-light tracking-[-0.012em]">
                      {cat.label}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block font-mono text-[12px] tracking-[0.04em]',
                        active ? 'opacity-75' : 'text-muted-foreground',
                      )}
                    >
                      {en} enabled · {cat.skills.length - en} disabled
                    </span>
                  </span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 font-mono text-[11px] font-medium tracking-[0.08em] uppercase',
                      active
                        ? 'opacity-80'
                        : 'text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
                    )}
                  >
                    {active ? 'Showing' : 'Show'}
                  </span>
                </button>
              </li>
            )
          })}
          <li className="flex">
            <button
              type="button"
              onClick={onOpenPacks}
              title="Browse all packs and turn on more skills"
              className={cn(
                'group g-chip flex w-full cursor-pointer items-center gap-5 rounded-[22px] px-5 py-4 text-left',
                FOCUS,
              )}
            >
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-full bg-[oklch(0.3_0.015_240/0.06)] text-muted-foreground transition-colors duration-150 group-hover:text-[var(--primary)]"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.1875rem] leading-[1.3] font-light tracking-[-0.012em]">
                  Add more
                </span>
                <span className="mt-0.5 block font-mono text-[12px] tracking-[0.04em] text-muted-foreground">
                  Browse all packs
                </span>
              </span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="ml-auto size-4 shrink-0 text-muted-foreground transition-[translate] duration-150 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </li>
        </ul>
      </section>

      {/* Latest runs */}
      <section aria-labelledby="hq-runs">
        <PanelHeader
          title={<span id="hq-runs">Recent runs</span>}
          action={
            runs.length > 8 ? (
              <span className="font-mono text-[12px] text-muted-foreground">Latest 8 of {runs.length}</span>
            ) : undefined
          }
        />
        <div className="g-chip mt-3 rounded-[22px] p-1.5">
          {runs.length ? (
            <ul className="flex flex-col gap-0.5">
              {runs.slice(0, 8).map(run => (
                <li key={run.id}>
                  <RunRow run={run} onClick={onViewRun ? () => onViewRun(run) : undefined} />
                  {/* Failed runs only: "Why?" reads the log on demand. */}
                  <RunDiagnosisToggle
                    run={run}
                    onConnect={onConnect}
                    className="px-3 pt-1 pb-3 sm:pl-[calc(7.5rem+1.5rem)]"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No runs yet" hint="Open any skill and press Run, or use Run now in the setup list." />
          )}
        </div>
      </section>
    </div>
  )
}
