'use client'

import { useState } from 'react'
import type { Run } from '../lib/types'
import { isDiagnosable, useRunDiagnosis } from '../lib/use-run-diagnosis'

interface RunDiagnosisProps {
  run: Pick<Run, 'id' | 'conclusion'>
  // Opens the Connect modal for the harness the run used (when it printed one).
  onConnect?: (harness?: string) => void
  className?: string
}

// One plain line for a failed run: why it failed and what to do next, plus
// Connect when the credential is the problem. Loads as soon as it is shown,
// so use it where the operator already opened the run (the run detail panel).
// Renders nothing for runs that did not fail.
export function RunDiagnosis({ run, onConnect, className = '' }: RunDiagnosisProps) {
  const state = useRunDiagnosis(run)
  if (state.status !== 'done' || !state.diagnosis) return null
  const d = state.diagnosis
  return (
    <div className={`text-[11px] font-mono leading-relaxed ${className}`}>
      <span className="text-aeon-red-alert">{d.reason}</span>{' '}
      <span className="text-primary-50">Next step: {d.hint}</span>
      {d.credential && onConnect && (
        <button onClick={() => onConnect(d.harness)} className="btn-mini-go ml-2">
          Connect
        </button>
      )}
    </div>
  )
}

// The same line behind a "Why?" toggle, for run lists: the log is read only
// once the operator opens it (lib/use-run-diagnosis.ts caches it per run).
export function RunDiagnosisToggle({ run, onConnect, className = '' }: RunDiagnosisProps) {
  const [open, setOpen] = useState(false)
  const state = useRunDiagnosis(run, open)
  if (!isDiagnosable(run)) return null
  const d = state.status === 'done' ? state.diagnosis : null
  return (
    <div className={`text-[11px] font-mono leading-relaxed ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-primary-40 hover:text-aeon-fg underline decoration-dotted underline-offset-2"
      >
        {open ? 'Hide' : 'Why?'}
      </button>
      {open &&
        (state.status === 'loading' ? (
          <span className="ml-2 text-primary-40">Reading the run log...</span>
        ) : state.status === 'error' ? (
          <span className="ml-2 text-primary-40">Could not read the run log. Try again in a minute.</span>
        ) : !d ? (
          <span className="ml-2 text-primary-40">No reason found in the log.</span>
        ) : (
          <>
            {' '}
            <span className="text-aeon-red-alert">{d.reason}</span>{' '}
            <span className="text-primary-50">Next step: {d.hint}</span>
            {d.credential && onConnect && (
              <button onClick={() => onConnect(d.harness)} className="btn-mini-go ml-2">
                Connect
              </button>
            )}
          </>
        ))}
    </div>
  )
}
