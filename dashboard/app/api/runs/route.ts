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

export async function GET() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', ...ghArgsRepo(), '--json', 'databaseId,name,status,conclusion,createdAt,url,displayTitle', '--limit', '20'],
      { stdio: 'pipe', cwd: REPO_ROOT },
    ).toString()
    const raw = JSON.parse(out)
    const runs = raw.map((r: Record<string, unknown>) => ({
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
