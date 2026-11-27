'use client'

import { useId, useState } from 'react'
import type { Run } from '../lib/types'
import type { Diagnosis } from '../lib/run-diagnosis'
import { isDiagnosable, useRunDiagnosis } from '../lib/use-run-diagnosis'
import { ActionButton, ATTN, Chevron, FOCUS } from './glass/connect/ui'
import { RunIcon } from './glass/connect/run-status'
import { cn } from '@/lib/cn'

interface RunDiagnosisProps {
  run: Pick<Run, 'id' | 'conclusion'>
  // Opens the Connect modal for the harness the run used (when it printed one).
  onConnect?: (harness?: string) => void
  className?: string
}

// Why it failed (deep orange, with the failed icon) and the next step (smoke), plus Connect
// when the credential is the problem.
function Reason({ d, onConnect }: { d: Diagnosis; onConnect?: (harness?: string) => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <RunIcon state="failed" className="mt-[0.2em]" />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', ATTN)}>{d.reason}</p>
        <p className="mt-0.5 text-muted-foreground">Next step: {d.hint}</p>
        {d.credential && onConnect && (
          <ActionButton onClick={() => onConnect(d.harness)} className="mt-2.5">
            Connect
          </ActionButton>
        )}
      </div>
    </div>
  )
}

// One plain line for a failed run: why it failed and what to do next, plus
// Connect when the credential is the problem. Loads as soon as it is shown,
// so use it where the operator already opened the run (the run detail panel).
// Renders nothing for runs that did not fail.
export function RunDiagnosis({ run, onConnect, className = '' }: RunDiagnosisProps) {
  const state = useRunDiagnosis(run)
  if (state.status !== 'done' || !state.diagnosis) return null
  return (
    <div className={cn('rounded-[16px] bg-[oklch(0.65_0.23_32/0.07)] px-4 py-3 text-[14px] leading-[1.5]', className)}>
      <Reason d={state.diagnosis} onConnect={onConnect} />
    </div>
  )
}

// The same line behind a "Why?" toggle, for run lists: the log is read only
// once the operator opens it (lib/use-run-diagnosis.ts caches it per run).
export function RunDiagnosisToggle({ run, onConnect, className = '' }: RunDiagnosisProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const state = useRunDiagnosis(run, open)
  if (!isDiagnosable(run)) return null
  const d = state.status === 'done' ? state.diagnosis : null
  return (
    <div className={cn('text-[14px] leading-[1.5]', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          'g-chip inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full pr-2.5 pl-3.5 font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground uppercase transition-[background-color] duration-150',
          FOCUS,
        )}
      >
        {open ? 'Hide reason' : 'Why did it fail?'}
        <Chevron open={open} className="size-3.5" />
      </button>
      <div id={id} aria-live="polite">
        {open && (
          <div className="mt-2.5">
            {state.status === 'loading' ? (
              <p className="text-muted-foreground">Reading the run log...</p>
            ) : state.status === 'error' ? (
              <p className="text-muted-foreground">Could not read the run log. Try again in a minute.</p>
            ) : !d ? (
              <p className="text-muted-foreground">No reason found in the log.</p>
            ) : (
              <Reason d={d} onConnect={onConnect} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
