// A run's state as an icon plus a word, never color alone. Orange = needs attention (failed,
// timed out) or is happening now (running); smoke for everything else (done, queued, cancelled).
import type { Run } from '@/lib/types'
import { cn } from '@/lib/cn'
import { getSkillStatus, timeAgo } from '@/lib/utils'
import { FOCUS, TAG, TAG_ATTN } from './recipes'

export type RunState = 'done' | 'failed' | 'running' | 'queued' | 'cancelled' | 'other'

export function runState(run: Pick<Run, 'status' | 'conclusion'>): RunState {
  if (run.conclusion === 'success') return 'done'
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure')
    return 'failed'
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return 'cancelled'
  if (run.status === 'in_progress') return 'running'
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending' || run.status === 'requested')
    return 'queued'
  return 'other'
}

const LABELS: Record<RunState, string> = {
  done: 'Done',
  failed: 'Failed',
  running: 'Running',
  queued: 'Queued',
  cancelled: 'Cancelled',
  other: 'Unknown',
}

export function runLabel(run: Pick<Run, 'status' | 'conclusion'>): string {
  return run.conclusion === 'timed_out' ? 'Timed out' : LABELS[runState(run)]
}

/** The icon alone (decorative; pair it with the label). */
export function RunIcon({ state, className }: { state: RunState; className?: string }) {
  const cls = cn(
    'size-4 shrink-0',
    state === 'failed' || state === 'running' ? 'text-[oklch(0.55_0.2_33)]' : 'text-muted-foreground',
    className,
  )
  if (state === 'done')
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M5.4 8.2 7.2 10l3.4-3.8" />
      </svg>
    )
  if (state === 'failed')
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={cls} fill="currentColor">
        <circle cx="8" cy="8" r="7" />
        <path
          d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
          stroke="oklch(0.985 0.004 220)"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </svg>
    )
  if (state === 'running')
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cn(cls, 'motion-safe:animate-spin [animation-duration:1.6s]')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6.25" opacity={0.25} />
        <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" />
      </svg>
    )
  if (state === 'queued')
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6.25" strokeDasharray="2 2.6" />
      </svg>
    )
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cls}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.2 8h5.6" />
    </svg>
  )
}

/** Icon + word, e.g. "(x) Failed". */
export function RunStatus({ run, className }: { run: Pick<Run, 'status' | 'conclusion'>; className?: string }) {
  const state = runState(run)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11.5px] font-medium tracking-[0.08em] uppercase',
        state === 'failed' ? 'text-[oklch(0.5_0.19_33)]' : 'text-muted-foreground',
        className,
      )}
    >
      <RunIcon state={state} />
      {runLabel(run)}
    </span>
  )
}

/** A skill's live state as a small orange tag, only when it needs you ("Failed last run": its
 *  newest run failed or timed out) or is running now ("Working"). Same logic and words as the
 *  sidebar roster (getSkillStatus); renders nothing in the plain On / Off states. */
export function SkillRunTag({
  skill,
  runs,
  className,
}: {
  skill: { name: string; enabled: boolean }
  runs: Run[]
  className?: string
}) {
  const { color } = getSkillStatus(skill.name, skill.enabled, runs)
  if (color !== 'red' && color !== 'orange') return null
  const failed = color === 'red'
  return (
    <span role="status" className={cn(TAG, TAG_ATTN, 'h-7 gap-1.5 px-2.5 text-[10.5px]', className)}>
      <RunIcon state={failed ? 'failed' : 'running'} className="size-3.5 text-current" />
      {failed ? 'Failed last run' : 'Working'}
    </span>
  )
}

/** The skill's name from a run's workflow title ("skill: digest" -> "digest"). */
export function runName(run: Pick<Run, 'workflow'>): string {
  return run.workflow.replace(/^skill:\s*/, '')
}

/** One run in a list: status, name, time. A failed run gets a soft orange wash so it stands out
 *  in a long list without relying on the color of the icon alone. */
export function RunRow({
  run,
  onClick,
  compact,
  className,
}: {
  run: Run
  onClick?: () => void
  compact?: boolean
  className?: string
}) {
  const failed = runState(run) === 'failed'
  const body = (
    <>
      <RunStatus run={run} className={compact ? 'w-[6.5rem] shrink-0' : 'w-[7.5rem] shrink-0'} />
      <span className={cn('min-w-0 flex-1 truncate', compact ? 'text-[14px]' : 'text-[15px]')}>{runName(run)}</span>
      <time dateTime={run.created_at} className="shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums">
        {timeAgo(run.created_at)}
      </time>
    </>
  )
  const cls = cn(
    'flex w-full items-center gap-3 rounded-[14px] px-3 text-left',
    compact ? 'min-h-11 py-2' : 'min-h-12 py-2.5',
    failed && 'bg-[oklch(0.65_0.23_32/0.07)]',
    className,
  )
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, 'cursor-pointer transition-[background-color] duration-150 hover:bg-[var(--hover)]', FOCUS)}
    >
      {body}
    </button>
  )
}
