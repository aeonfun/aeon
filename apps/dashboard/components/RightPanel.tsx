'use client'

import { useEffect, useRef, useState } from 'react'
import type { Run, SkillOutput, AnalyticsData } from '../lib/types'
import type { RunLogs } from '../lib/runs'
import { timeAgo } from '../lib/utils'
import { SpecNode } from './SpecNode'
import { PanelError } from './PanelError'
import { cn } from '@/lib/cn'
import { CountUp } from './glass/count-up'
import { RunRow, RunStatus, runName, runState } from './glass/connect/run-status'
import { ACTION, CHIP, CHIP_OFF, CHIP_ON, FOCUS, IconButton, Loading, SMALL_LABEL } from './glass/connect/ui'
import { useNarrow } from '@/lib/use-narrow'
import { useFocusTrap } from './glass/connect/use-focus-trap'
import { RunDiagnosis } from './RunDiagnosis'

interface RightPanelProps {
  runs: Run[]
  outputs: SkillOutput[]
  feedLoading: boolean
  feedError: boolean
  analyticsData: AnalyticsData | null
  analyticsError: boolean
  // Phones: the panel is a slide-in drawer opened from the dashboard's mobile bar.
  drawerOpen?: boolean
  onCloseDrawer?: () => void
  onRefresh: () => void
  onFetchAnalytics: () => void
  // A failed run's credential problem: open Connect for the run's harness.
  onConnect?: (harness?: string) => void
}

export function RightPanel({
  runs,
  outputs,
  feedLoading,
  feedError,
  analyticsData,
  analyticsError,
  drawerOpen,
  onCloseDrawer,
  onRefresh,
  onFetchAnalytics,
  onConnect,
}: RightPanelProps) {
  const [rightTab, setRightTab] = useState<'feed' | 'runs' | 'analytics'>('feed')
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [runLogs, setRunLogs] = useState('')
  const [runSummary, setRunSummary] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [showFullLogs, setShowFullLogs] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const narrow = useNarrow()
  // On phones the panel is a drawer: focus inside, Tab kept inside, Escape closes it.
  const drawer = useRef<HTMLElement>(null)
  useFocusTrap(drawer, narrow && !!drawerOpen, onCloseDrawer)

  // Restore the collapsed state on mount (set in an effect, not the initializer,
  // to avoid an SSR/client hydration mismatch).
  useEffect(() => {
    if (localStorage.getItem('aeon-panel-collapsed') === '1') setCollapsed(true)
  }, [])

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next)
    try {
      localStorage.setItem('aeon-panel-collapsed', next ? '1' : '0')
    } catch {}
  }

  const viewRunLogs = async (run: Run) => {
    setSelectedRun(run)
    setRunLogs('')
    setRunSummary('')
    setShowFullLogs(false)
    setLogsLoading(true)
    setRightTab('runs')
    try {
      const r = await fetch(`/api/runs/${run.id}/logs`)
      if (r.ok) {
        const d = (await r.json()) as RunLogs
        setRunSummary(d.summary || '')
        setRunLogs(d.logs || '')
      }
    } catch {
      setRunLogs('Failed')
    } finally {
      setLogsLoading(false)
    }
  }

  // Collapsed: one slim control that brings the panel back (a rail beside the page on wide
  // screens, a bar under it in between). Not on phones, where the panel is a drawer instead.
  if (collapsed && !narrow) {
    return (
      <div className="md:col-start-2 xl:sticky xl:top-24 xl:col-start-3 xl:row-start-1 xl:self-start">
        <button
          type="button"
          onClick={() => toggleCollapsed(false)}
          title="Expand panel"
          aria-label="Expand feed, runs and analytics"
          className={cn(
            'g-chip flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full px-4 transition-[background-color] duration-150 xl:h-auto xl:w-11 xl:flex-col xl:py-5',
            FOCUS,
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 text-muted-foreground xl:rotate-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
          <span className={cn(SMALL_LABEL, 'xl:[writing-mode:vertical-rl]')}>Feed, runs, analytics</span>
        </button>
      </div>
    )
  }

  const total = analyticsData ? Math.max(...analyticsData.skills.map(sk => sk.total), 1) : 1
  const clean = (t: string) => t.replace(/\x1b\[[0-9;]*m/g, '')

  return (
    <aside
      ref={drawer}
      aria-label="Feed, runs and analytics"
      role={narrow ? 'dialog' : undefined}
      aria-modal={narrow && drawerOpen ? true : undefined}
      inert={narrow && !drawerOpen}
      className={
        narrow
          ? cn(
              'fixed inset-y-0 right-0 z-[101] flex w-[min(360px,90vw)] p-2 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              drawerOpen ? 'translate-x-0' : 'translate-x-[105%]',
            )
          : 'min-w-0 md:col-start-2 xl:sticky xl:top-24 xl:col-start-3 xl:row-start-1 xl:w-[300px] xl:self-start'
      }
    >
      <div
        className={cn(
          'g-glass flex w-full flex-col rounded-[24px]',
          narrow ? 'c-solid h-full' : 'xl:max-h-[calc(100svh-7rem)]',
        )}
      >
        {/* Tabs, refresh, collapse */}
        <div className="relative z-[1] flex items-center gap-1.5 px-3 pt-3 pb-2">
          <div role="tablist" aria-label="Activity" className="flex min-w-0 gap-0.5">
            {(['feed', 'runs', 'analytics'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={rightTab === tab}
                onClick={() => {
                  setRightTab(tab)
                  if (tab === 'analytics') onFetchAnalytics()
                }}
                className={cn(CHIP, 'h-9 px-2.5 text-[11px] tracking-[0.06em]', rightTab === tab ? CHIP_ON : CHIP_OFF)}
              >
                {tab}
              </button>
            ))}
          </div>
          <IconButton onClick={onRefresh} title="Refresh" aria-label="Refresh" className="ml-auto size-9">
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
              <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" />
            </svg>
          </IconButton>
          <IconButton
            onClick={() => (narrow ? onCloseDrawer?.() : toggleCollapsed(true))}
            title={narrow ? 'Close' : 'Collapse panel'}
            aria-label={narrow ? 'Close panel' : 'Collapse panel'}
            className="size-9"
          >
            {narrow ? (
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
            ) : (
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
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            )}
          </IconButton>
        </div>

        <div className="c-scroll relative z-[1] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
          {/* Feed */}
          {rightTab === 'feed' &&
            (feedLoading ? (
              <Loading label="Loading the feed" />
            ) : feedError ? (
              <PanelError label="the feed" onRetry={onRefresh} />
            ) : outputs.length > 0 ? (
              <div className="space-y-4 px-1 pt-1">
                {outputs.map(o => (
                  <article key={o.filename} className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className="truncate text-[14px] font-medium">{o.skill}</span>
                      <time
                        dateTime={o.timestamp}
                        className="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground"
                      >
                        {timeAgo(o.timestamp)}
                      </time>
                    </div>
                    {o.spec?.root && o.spec?.elements ? <SpecNode id={o.spec.root} elements={o.spec.elements} /> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div>
                {!runs.length ? (
                  <p className={cn(SMALL_LABEL, 'px-4 py-12 text-center')}>No activity yet</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {runs.map(run => (
                      <li key={run.id}>
                        <RunRow run={run} compact onClick={() => viewRunLogs(run)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {/* Runs */}
          {rightTab === 'runs' &&
            (selectedRun ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 px-1 pt-1 pb-2">
                  <IconButton
                    onClick={() => {
                      setSelectedRun(null)
                      setRunLogs('')
                      setRunSummary('')
                    }}
                    aria-label="Back to runs"
                    className="size-9"
                  >
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
                      <path d="M10 3.5 5.5 8l4.5 4.5" />
                    </svg>
                  </IconButton>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{runName(selectedRun)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                  <RunStatus run={selectedRun} />
                  <span className="font-mono text-[12px] text-muted-foreground">{timeAgo(selectedRun.created_at)}</span>
                  <span className="ml-auto flex gap-1.5">
                    <a
                      href={selectedRun.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(ACTION, 'h-9 px-3 text-[13px]')}
                    >
                      GitHub<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </span>
                </div>
                <div className="px-1">
                  <RunDiagnosis
                    run={selectedRun}
                    onConnect={onConnect}
                    className="mb-3 rounded-[16px] bg-[oklch(0.65_0.23_32/0.07)] px-3 py-2.5"
                  />
                  {logsLoading ? (
                    <Loading label="Reading the log" />
                  ) : (
                    <div className="space-y-3">
                      {runSummary ? (
                        <>
                          <pre className="g-code overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap">
                            {clean(runSummary).replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/gm, '')}
                          </pre>
                          <button
                            type="button"
                            onClick={() => setShowFullLogs(!showFullLogs)}
                            aria-expanded={showFullLogs}
                            className={cn(ACTION, 'h-9 px-3 text-[13px]')}
                          >
                            {showFullLogs ? 'Hide full log' : 'Show full log'}
                          </button>
                          {showFullLogs && (
                            <pre className="g-code overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap text-muted-foreground">
                              {clean(runLogs)}
                            </pre>
                          )}
                        </>
                      ) : (
                        <pre className="g-code overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap">
                          {clean(runLogs)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {!runs.length ? (
                  <p className={cn(SMALL_LABEL, 'px-4 py-12 text-center')}>No runs</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {runs.map(run => (
                      <li key={run.id}>
                        <RunRow run={run} compact onClick={() => viewRunLogs(run)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {/* Analytics */}
          {rightTab === 'analytics' &&
            (analyticsError ? (
              <PanelError label="analytics" onRetry={onFetchAnalytics} />
            ) : !analyticsData ? (
              <Loading label="Loading analytics" />
            ) : (
              <div className="space-y-4 px-1 pt-1">
                <dl className="grid grid-cols-2 gap-2">
                  <div className="g-chip rounded-[18px] px-3.5 py-3">
                    <dt className={SMALL_LABEL}>Runs</dt>
                    <dd className="mt-1 font-display text-[2rem] leading-[0.95] font-light tracking-[-0.05em] tabular-nums">
                      <CountUp to={analyticsData.summary.totalRuns} />
                    </dd>
                  </div>
                  <div className="g-chip rounded-[18px] px-3.5 py-3">
                    <dt className={SMALL_LABEL}>Succeeded</dt>
                    <dd
                      className={cn(
                        'mt-1 font-display text-[2rem] leading-[0.95] font-light tracking-[-0.05em] tabular-nums',
                        analyticsData.summary.totalRuns > 0 &&
                          analyticsData.summary.overallSuccessRate < 80 &&
                          'text-[oklch(0.5_0.19_33)]',
                        !analyticsData.summary.totalRuns && 'text-muted-foreground',
                      )}
                    >
                      {/* No runs yet is not a failure: a neutral dash, not a red 0%. */}
                      {analyticsData.summary.totalRuns > 0 ? (
                        <CountUp to={analyticsData.summary.overallSuccessRate} suffix="%" />
                      ) : (
                        <>
                          <span aria-hidden>-</span>
                          <span className="sr-only">No runs yet</span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                {analyticsData.insights.length > 0 && (
                  <ul className="space-y-1.5">
                    {analyticsData.insights.map((ins, i) => (
                      <li
                        key={i}
                        className={cn(
                          'flex items-start gap-2.5 rounded-[16px] px-3 py-2.5 text-[13px] leading-[1.5]',
                          ins.type === 'warning' ? 'bg-[oklch(0.65_0.23_32/0.08)]' : 'bg-[var(--hover)]',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-[0.45em] size-1.5 shrink-0 rounded-full',
                            ins.type === 'warning' ? 'bg-[var(--primary)]' : 'bg-[var(--g-ink-soft)]',
                          )}
                        />
                        <span>
                          {ins.type === 'warning' && <span className="sr-only">Warning: </span>}
                          {ins.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!analyticsData.skills.length ? (
                  <p className="px-4 py-8 text-center text-[13px] leading-[1.5] text-muted-foreground">
                    No runs yet. Success rates by skill show up here after the first runs.
                  </p>
                ) : (
                  <div>
                    <p className={cn(SMALL_LABEL, 'mb-1.5 flex justify-between px-1')}>
                      <span>By skill</span>
                      <span>Success</span>
                    </p>
                    <ul className="space-y-0.5">
                      {analyticsData.skills.map(s => {
                        const last = s.lastConclusion
                          ? runState({ status: 'completed', conclusion: s.lastConclusion })
                          : 'other'
                        return (
                          <li key={s.name} className="flex items-center gap-2 px-1 py-1.5">
                            <span className="w-[6.5rem] shrink-0 truncate text-[13px]" title={s.name}>
                              {s.name}
                            </span>
                            <span
                              aria-hidden
                              className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hover)]"
                            >
                              {s.success > 0 && (
                                <span
                                  className="h-full bg-[var(--g-ink-soft)]"
                                  style={{ width: `${(s.success / total) * 100}%` }}
                                />
                              )}
                              {s.failure > 0 && (
                                <span
                                  className="h-full bg-[var(--primary)]"
                                  style={{ width: `${(s.failure / total) * 100}%` }}
                                />
                              )}
                            </span>
                            <span
                              className={cn(
                                'w-10 shrink-0 text-right font-mono text-[12px] tabular-nums',
                                s.successRate < 80 ? 'text-[oklch(0.5_0.19_33)]' : 'text-muted-foreground',
                              )}
                            >
                              {s.successRate}%
                            </span>
                            <span className="sr-only">
                              : {s.success} succeeded, {s.failure} failed{last === 'failed' ? ', last run failed' : ''}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </aside>
  )
}
