import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT, ghArgsRepo } from '@/lib/gh'
import type { GhRunJson } from '@/lib/types'

type GhRunListItem = Pick<GhRunJson, 'databaseId' | 'name' | 'status' | 'conclusion' | 'createdAt' | 'url' | 'displayTitle'>

export async function GET() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', ...ghArgsRepo(), '--json', 'databaseId,name,status,conclusion,createdAt,url,displayTitle', '--limit', '20'],
      { stdio: 'pipe', cwd: REPO_ROOT },
    ).toString()
    const raw: GhRunListItem[] = JSON.parse(out)
    const runs = raw.map((r) => ({
      id: r.databaseId,
      workflow: r.displayTitle || r.name,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.createdAt,
      url: r.url,
    }))
    return NextResponse.json({ runs })
  } catch {
    return NextResponse.json({ runs: [] })
  }
}
