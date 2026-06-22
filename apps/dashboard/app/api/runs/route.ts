import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT, ghArgsRepo } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import type { GhRunJson } from '@/lib/types'

type GhRunListItem = Pick<GhRunJson, 'databaseId' | 'name' | 'status' | 'conclusion' | 'createdAt' | 'url' | 'displayTitle' | 'event'>

// Events that represent genuine Aeon skill activity, taken from the `on:` blocks
// of the workflows Aeon owns: aeon.yml (workflow_dispatch / workflow_call / issues),
// messages.yml (schedule / workflow_dispatch / repository_dispatch), chain-runner.yml
// (workflow_dispatch). Allow-listing these keeps the feed to Aeon-launched runs and
// structurally excludes repo CI (push / pull_request) and GitHub-managed noise like
// Dependabot (event: 'dynamic'), without enumerating every bot/managed run by name.
const AEON_EVENTS = new Set(['workflow_dispatch', 'workflow_call', 'schedule', 'repository_dispatch', 'issues'])

export async function GET() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', ...ghArgsRepo(), '--json', 'databaseId,name,status,conclusion,createdAt,url,displayTitle,event', '--limit', '30'],
      { stdio: 'pipe', cwd: REPO_ROOT },
    ).toString()
    const raw: GhRunListItem[] = JSON.parse(out)
    const runs = raw
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
    return NextResponse.json({ runs })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to list runs')
  }
}
