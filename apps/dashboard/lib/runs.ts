import { execFileSync } from 'child_process'
import { REPO_ROOT, ghArgsRepo } from './gh'
import type { GhRunJson, Run } from './types'

type GhRunListItem = Pick<GhRunJson, 'databaseId' | 'name' | 'status' | 'conclusion' | 'createdAt' | 'url' | 'displayTitle' | 'event'>
type GhRunView = Pick<GhRunJson, 'status' | 'conclusion' | 'displayTitle' | 'jobs'>

// Events that represent genuine Aeon skill activity, from the `on:` blocks of the
// workflows Aeon owns (aeon.yml, scheduler.yml, messages.yml, chain-runner.yml).
// Allow-listing these keeps the feed to Aeon-launched runs and structurally
// excludes repo CI (push / pull_request) and managed noise like Dependabot.
const AEON_EVENTS = new Set(['workflow_dispatch', 'workflow_call', 'schedule', 'repository_dispatch', 'issues'])

export interface RunLogs {
  id: string
  title: string
  status: string
  conclusion: string | null
  logs: string
  summary: string
}

// Recent Aeon-launched runs, newest first. Shared by GET /api/runs and `aeon runs ls`.
export function listRuns(limit = 30): Run[] {
  const out = execFileSync(
    'gh',
    ['run', 'list', ...ghArgsRepo(), '--json', 'databaseId,name,status,conclusion,createdAt,url,displayTitle,event', '--limit', String(limit)],
    { stdio: 'pipe', cwd: REPO_ROOT },
  ).toString()
  const raw: GhRunListItem[] = JSON.parse(out)
  return raw
    // Keep only Aeon-launched runs; drop CI, Dependabot, and other managed noise.
    .filter((r) => AEON_EVENTS.has(r.event))
    // "Sync from upstream" is schedule-triggered fork maintenance, not skill activity.
    .filter((r) => r.name !== 'Sync from upstream')
    .map((r) => ({
      id: r.databaseId,
      workflow: r.displayTitle || r.name,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.createdAt,
      url: r.url,
    }))
}

// A single run's status plus the interesting slice of its logs: the Claude "Run"
// step output and the trailing `## Summary` block. Shared by GET /api/runs/[id]/logs
// and `aeon runs logs <id>`. Throws on an invalid id or a gh failure.
export function getRunLogs(id: string): RunLogs {
  if (!/^\d+$/.test(id)) throw new Error('Invalid run ID')

  const repoArgs = ghArgsRepo()

  const infoRaw = execFileSync(
    'gh',
    ['run', 'view', id, ...repoArgs, '--json', 'status,conclusion,displayTitle,jobs'],
    { stdio: 'pipe', cwd: REPO_ROOT, timeout: 15000 },
  ).toString()
  const info: GhRunView = JSON.parse(infoRaw)

  // Get logs - use --log-failed for failed runs, --log for completed.
  let logs = ''
  try {
    const logFlag = info.conclusion === 'failure' ? '--log-failed' : '--log'
    logs = execFileSync('gh', ['run', 'view', id, ...repoArgs, logFlag], {
      stdio: 'pipe',
      cwd: REPO_ROOT,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString()
  } catch {
    logs = '(Logs not available yet - run may still be in progress)'
  }

  // Extract the "Run" step output from Claude. Lines look like: "job<TAB>step<TAB>line".
  const lines = logs.split('\n')
  const runStepLines: string[] = []
  let inRunStep = false
  for (const line of lines) {
    const parts = line.split('\t')
    if (parts.length >= 3) {
      const stepName = parts[1]
      if (stepName === 'Run' || stepName === 'Collect and dispatch messages') {
        inRunStep = true
        runStepLines.push(parts.slice(2).join('\t'))
      } else if (inRunStep && stepName !== 'Run' && stepName !== 'Collect and dispatch messages') {
        inRunStep = false
      }
    } else if (inRunStep) {
      runStepLines.push(line)
    }
  }
  const output = runStepLines.length > 0 ? runStepLines.join('\n') : logs

  // Extract the ## Summary block Claude outputs at the end of each skill run.
  const outputLines = output.split('\n')
  const summaryLines: string[] = []
  let inSummary = false
  for (const line of outputLines) {
    const clean = line
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, '')
    if (/^#{1,3}\s+Summary/.test(clean)) {
      inSummary = true
      summaryLines.push(line)
    } else if (inSummary) {
      if (/^#{1,2}\s+/.test(clean) && !/^###/.test(clean)) break
      summaryLines.push(line)
    }
  }

  const trimmedLines = output.split('\n')
  const trimmed = trimmedLines.length > 500
    ? '... (truncated, showing last 500 lines)\n' + trimmedLines.slice(-500).join('\n')
    : output

  return {
    id,
    title: info.displayTitle,
    status: info.status,
    conclusion: info.conclusion,
    logs: trimmed,
    summary: summaryLines.length > 0 ? summaryLines.join('\n') : '',
  }
}
