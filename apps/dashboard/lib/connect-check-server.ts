// Server half of the post-connect "Test connection": dispatch the tiny
// connect-check skill on the harness being connected, then find that run again
// and judge it with lib/connect-check.ts. Local mode talks to GitHub through the
// operator's gh CLI; the hosted fork swaps listRecentRuns/fetchRunLog/dispatch
// for its GitHub App token and keeps the rest.
import { execFile } from 'child_process'
import { promisify } from 'util'
import { REPO_ROOT, ghArgsRepo } from './gh'
import { listSecretNames } from './secrets-catalog'
import type { KvStore } from './connect-store'
import { CONNECT_CHECK_SKILL, interpretRun, matchRun, type CheckResult } from './connect-check'
import { makeNonce } from './telegram-link'
import { reportsTokenUsage } from './manifest'

const run = promisify(execFile)
const gh = async (args: string[], timeout = 20_000) =>
  (await run('gh', args, { cwd: REPO_ROOT, timeout, maxBuffer: 20 * 1024 * 1024 })).stdout

const HARNESS_RE = /^[a-z]+$/
const metaKey = (id: string) => `connect-check:dispatch:${id}`
const resultKey = (runId: number) => `connect-check:run:${runId}`
// No run after this long means it never started (Actions off, bad workflow).
const START_TIMEOUT_MS = 3 * 60_000

interface RunRow { databaseId: number; displayTitle: string; status: string; conclusion: string | null; url: string }

async function listRecentRuns(): Promise<RunRow[]> {
  const out = await gh(['run', 'list', ...ghArgsRepo(), '--workflow', 'aeon.yml', '--json', 'databaseId,displayTitle,status,conclusion,url', '--limit', '40'])
  return JSON.parse(out) as RunRow[]
}

async function fetchRunLog(runId: number): Promise<string> {
  return gh(['run', 'view', String(runId), ...ghArgsRepo(), '--log'], 45_000)
}

export async function dispatchConnectCheck(store: KvStore, harness: string): Promise<{ dispatchId: string }> {
  if (!HARNESS_RE.test(harness)) throw new Error(`Invalid harness: ${harness}`)
  const dispatchId = `cc-${harness}-${makeNonce().slice(0, 10)}`
  await gh(['workflow', 'run', 'aeon.yml', ...ghArgsRepo(),
    '-f', `skill=${CONNECT_CHECK_SKILL}`, '-f', `harness=${harness}`, '-f', `dispatch_id=${dispatchId}`])
  await store.set(metaKey(dispatchId), { harness, at: Date.now() }, 3600)
  return { dispatchId }
}

// The state of one dispatch (`dispatchId`), or of the newest connect-check run
// for `harness` when no id is given (the onboarding checklist's "verified").
export async function readConnectCheck(store: KvStore, harness: string, dispatchId?: string): Promise<CheckResult> {
  if (!HARNESS_RE.test(harness)) throw new Error(`Invalid harness: ${harness}`)
  const row = matchRun(await listRecentRuns(), { dispatchId, harness })
  if (!row) {
    if (!dispatchId) return { state: 'none' }
    const meta = await store.get<{ at: number }>(metaKey(dispatchId))
    if (meta && Date.now() - meta.at > START_TIMEOUT_MS) {
      return { state: 'fail', reason: 'The test run never started.', hint: 'Check that GitHub Actions is enabled for this repo (the Actions tab), then test again.' }
    }
    return { state: 'queued' }
  }
  const base = { runId: row.databaseId, runUrl: row.url }
  if (row.status !== 'completed') return { ...interpretRun({ status: row.status, conclusion: null, log: '', harness, secretsSet: [] }), ...base }

  const cached = await store.get<CheckResult>(resultKey(row.databaseId))
  if (cached) return cached
  let log: string
  try {
    log = await fetchRunLog(row.databaseId)
  } catch {
    // Logs can lag a few seconds behind completion; report running and retry.
    return { state: 'running', ...base }
  }
  let secretsSet: string[] = []
  try { secretsSet = listSecretNames() } catch { /* hint just gets less specific */ }
  const result = { ...interpretRun({ status: row.status, conclusion: row.conclusion, log, harness, secretsSet, usageReported: reportsTokenUsage(harness) }), ...base }
  await store.set(resultKey(row.databaseId), result, 86_400)
  return result
}
