'use client'

import { useEffect, useState } from 'react'
import type { Run } from './types'
import type { Diagnosis } from './run-diagnosis'

// Runs worth explaining: the ones that failed or hit their time limit.
export const isDiagnosable = (run: Pick<Run, 'conclusion'>) =>
  run.conclusion === 'failure' || run.conclusion === 'timed_out'

// Failed-run diagnoses, fetched lazily (only when shown or opened) and kept for
// the page's lifetime: a finished run never changes. A failed fetch is
// forgotten, so opening it again asks again (logs can lag behind completion).
const cache = new Map<number, Promise<Diagnosis | null>>()

function fetchDiagnosis(id: number): Promise<Diagnosis | null> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`/api/runs/${id}/diagnosis`).then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return ((await r.json()) as { diagnosis: Diagnosis | null }).diagnosis
    })
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

export type DiagnosisState = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; diagnosis: Diagnosis | null }

// Why `run` failed, once its log has been read. Idle for runs that did not
// fail, and while `enabled` is false (e.g. a closed "Why?" toggle).
export function useRunDiagnosis(run: Pick<Run, 'id' | 'conclusion'>, enabled = true): DiagnosisState {
  const id = enabled && isDiagnosable(run) ? run.id : null
  const [result, setResult] = useState<{ id: number; state: DiagnosisState } | null>(null)
  useEffect(() => {
    if (id === null) return
    let live = true
    fetchDiagnosis(id)
      .then(diagnosis => {
        if (live) setResult({ id, state: { status: 'done', diagnosis } })
      })
      .catch(() => {
        if (live) setResult({ id, state: { status: 'error' } })
      })
    return () => {
      live = false
      setResult(null)
    }
  }, [id])
  if (id === null) return { status: 'idle' }
  return result && result.id === id ? result.state : { status: 'loading' }
}
