'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { postJson } from './api-client'
import { isSettled, pollConnectCheck, type CheckResult } from './connect-check'

// Connect-check state for the whole page, per harness. The page (not the
// Connect modal) dispatches and polls, so closing the modal keeps the HQ
// checklist updating until the run settles or the poll times out.
export function useConnectChecks() {
  const [checks, setChecks] = useState<Record<string, CheckResult>>({})
  // One live poll per harness; starting another cancels the previous one.
  const polls = useRef(new Map<string, { cancelled: boolean }>())

  const setCheck = useCallback((harness: string, r: CheckResult) => setChecks((m) => ({ ...m, [harness]: r })), [])

  // Follow a dispatch (or, without an id, the newest connect-check run for the
  // harness) until it settles.
  const watch = useCallback((harness: string, dispatchId?: string) => {
    const prev = polls.current.get(harness)
    if (prev) prev.cancelled = true
    const token = { cancelled: false }
    polls.current.set(harness, token)
    const qs = `harness=${encodeURIComponent(harness)}${dispatchId ? `&id=${encodeURIComponent(dispatchId)}` : ''}`
    pollConnectCheck({
      read: async () => {
        const res = await fetch(`/api/connect-check?${qs}`)
        const d = await res.json() as CheckResult & { error?: string }
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
        return d
      },
      onUpdate: (r) => { if (!token.cancelled) setCheck(harness, r) },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: Date.now,
      cancelled: () => token.cancelled,
    }).finally(() => { if (polls.current.get(harness) === token) polls.current.delete(harness) })
  }, [setCheck])

  // Dispatch a fresh connect-check run for `harness` and follow it.
  const startCheck = useCallback(async (harness: string) => {
    setCheck(harness, { state: 'queued' })
    const { ok, data } = await postJson<{ dispatchId?: string; error?: string }>('/api/connect-check', { harness })
    if (!ok || !data.dispatchId) {
      setCheck(harness, { state: 'fail', reason: data.error || 'Could not start the test run.', hint: 'Check that gh is logged in and Actions is enabled, then test again.' })
      return
    }
    watch(harness, data.dispatchId)
  }, [setCheck, watch])

  // Load the newest result for `harness` (page load / harness switch), and
  // keep following it if that run is still going.
  const loadLatest = useCallback(async (harness: string) => {
    try {
      const res = await fetch(`/api/connect-check?harness=${encodeURIComponent(harness)}`)
      if (!res.ok) return
      const d = await res.json() as CheckResult
      // Don't let an older "none" overwrite a check started in this session.
      setChecks((m) => (m[harness] && d.state === 'none' ? m : { ...m, [harness]: d }))
      if (!isSettled(d.state) && !polls.current.has(harness)) watch(harness)
    } catch { /* checklist just shows untested */ }
  }, [watch])

  useEffect(() => {
    const live = polls.current
    return () => { for (const t of live.values()) t.cancelled = true }
  }, [])

  return { checks, setCheck, startCheck, loadLatest }
}
