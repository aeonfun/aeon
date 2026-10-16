// Server half of the failed-run explanation on HQ: read one run's log through
// the operator's gh CLI and judge it with lib/run-diagnosis.ts. A finished run
// never changes, so the verdict is cached in the KvStore (lib/connect-store.ts).
// The hosted fork swaps the gh calls for its GitHub App token and keeps the rest.
import { execFile } from 'child_process'
import { promisify } from 'util'
import { REPO_ROOT, ghArgsRepo } from './gh'
import type { KvStore } from './connect-store'
import { diagnoseRun, type Diagnosis } from './run-diagnosis'

const run = promisify(execFile)
const gh = async (args: string[], timeout = 20_000) =>
  (await run('gh', args, { cwd: REPO_ROOT, timeout, maxBuffer: 20 * 1024 * 1024 })).stdout

const cacheKey = (runId: string) => `run-diagnosis:${runId}`

// Why run `runId` failed or timed out; null while it is still going, or when
// it ended any other way.
// Throws on gh trouble (logs can lag a few seconds behind completion), so the
// caller can simply ask again later.
export async function readRunDiagnosis(store: KvStore, runId: string): Promise<Diagnosis | null> {
  if (!/^\d+$/.test(runId)) throw new Error('Invalid run ID')
  const cached = await store.get<{ diagnosis: Diagnosis | null }>(cacheKey(runId))
  if (cached) return cached.diagnosis
  const info = JSON.parse(await gh(['run', 'view', runId, ...ghArgsRepo(), '--json', 'status,conclusion'])) as {
    status: string
    conclusion: string | null
  }
  if (info.status !== 'completed') return null
  const diagnosis =
    info.conclusion !== 'failure' && info.conclusion !== 'timed_out'
      ? null
      : diagnoseRun({
          conclusion: info.conclusion,
          log: await gh(['run', 'view', runId, ...ghArgsRepo(), '--log'], 45_000),
        })
  await store.set(cacheKey(runId), { diagnosis }, 86_400)
  return diagnosis
}
