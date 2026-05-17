import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'
import { resolve } from 'path'

const REPO_ROOT = resolve(process.cwd(), '..')

function ghRepo(): string | null {
  try {
    const repo = execSync('gh repo set-default --view', { stdio: 'pipe', cwd: REPO_ROOT }).toString().trim()
    if (repo && !repo.startsWith('no default')) return repo
  } catch {}
  try {
    const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { stdio: 'pipe', cwd: REPO_ROOT }).toString().trim()
    if (repo) return repo
  } catch {}
  return null
}

function ghArgsRepo(): string[] {
  const repo = ghRepo()
  return repo ? ['-R', repo] : []
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Validate run ID
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 })
    }

    const repoArgs = ghArgsRepo()

    // Get run status first
    const infoRaw = execFileSync(
      'gh',
      ['run', 'view', id, ...repoArgs, '--json', 'status,conclusion,displayTitle,jobs'],
      { stdio: 'pipe', cwd: REPO_ROOT, timeout: 15000 },
    ).toString()
    const info = JSON.parse(infoRaw)

    // Get logs — use --log-failed for failed runs, --log for completed
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
      // Log fetch can fail for in-progress runs
      logs = '(Logs not available yet — run may still be in progress)'
    }

    // Extract the interesting part: the "Run" step output from Claude
    // Lines look like: "run<TAB>Run<TAB>2024-01-01T..."
    const lines = logs.split('\n')
    const runStepLines: string[] = []
    let inRunStep = false

    for (const line of lines) {
      // gh log format: jobName\tstepName\tlogLine
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

    // Use filtered logs if we found the Run step, otherwise show everything
    const output = runStepLines.length > 0 ? runStepLines.join('\n') : logs

    // Extract the ## Summary block that Claude outputs at the end of each skill run
    const outputLines = output.split('\n')
    const summaryLines: string[] = []
    let inSummary = false
    for (const line of outputLines) {
      // Strip ANSI escape codes and GitHub Actions timestamp prefix (e.g. "2026-03-19T23:20:35.6487406Z ")
      const clean = line
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, '')
      if (/^#{1,3}\s+Summary/.test(clean)) {
        inSummary = true
        summaryLines.push(line)
      } else if (inSummary) {
        // Stop at the next heading (## level) but allow ### subheadings
        if (/^#{1,2}\s+/.test(clean) && !/^###/.test(clean)) {
          break
        }
        summaryLines.push(line)
      }
    }

    // Trim to last 500 lines max
    const trimmedLines = output.split('\n')
    const trimmed = trimmedLines.length > 500
      ? '... (truncated, showing last 500 lines)\n' + trimmedLines.slice(-500).join('\n')
      : output

    return NextResponse.json({
      id,
      title: info.displayTitle,
      status: info.status,
      conclusion: info.conclusion,
      logs: trimmed,
      summary: summaryLines.length > 0 ? summaryLines.join('\n') : '',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch logs'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
