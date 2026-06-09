import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT, ghArgsRepo } from '@/lib/gh'
import type { GhRunJson } from '@/lib/types'

type GhRunListItem = Pick<GhRunJson, 'databaseId' | 'name' | 'status' | 'conclusion' | 'createdAt' | 'url' | 'displayTitle' | 'event'>

export async function GET() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', ...ghArgsRepo(), '--json', 'databaseId,name,status,conclusion,createdAt,url,displayTitle,event', '--limit', '30'],
      { stdio: 'pipe', cwd: REPO_ROOT },
    ).toString()
    const raw: GhRunListItem[] = JSON.parse(out)
    const runs = raw
      // Aeon skill activity fires on workflow_dispatch (dashboard "Run") or
      // schedule (cron). Repo CI (push / pull_request) and fork-maintenance
      // runs (upstream sync) are noise — keep them out of the feed and runs list.
      .filter((r) => r.event !== 'push' && r.event !== 'pull_request')
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
    const msg = error instanceof Error ? error.message : 'Failed to list runs'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
