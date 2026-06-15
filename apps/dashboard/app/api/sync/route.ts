import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
import { errorResponse } from '@/lib/http'

function run(cmd: string) {
  return execSync(cmd, { stdio: 'pipe', cwd: REPO_ROOT }).toString().trim()
}

export async function GET() {
  try {
    const status = run('git status --porcelain')
    const hasChanges = status.length > 0
    const changedFiles = hasChanges ? status.split('\n').length : 0
    let behind = 0
    try {
      run('git fetch origin main')
      const behindStr = run('git rev-list --count HEAD..origin/main')
      behind = parseInt(behindStr) || 0
    } catch (e) {
      // Offline / no remote / auth prompt - leave behind at 0 but make the
      // failure diagnosable instead of silently reporting "in sync".
      console.warn(`[sync] git fetch failed; "behind" count may be stale: ${e instanceof Error ? e.message : e}`)
    }
    return NextResponse.json({ hasChanges, changedFiles, behind })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to check status')
  }
}

export async function POST() {
  try {
    const status = run('git status --porcelain')
    if (!status) {
      return NextResponse.json({ ok: true, message: 'Already in sync' })
    }

    run('git add -A')

    try {
      run('git commit -m "chore: update config from dashboard"')
    } catch {
      return NextResponse.json({ ok: true, message: 'Nothing to commit' })
    }

    try {
      run('git push')
    } catch (e: unknown) {
      const pushErr = e instanceof Error ? e.message : 'Push failed'
      // Commit succeeded but push failed - still useful feedback
      return NextResponse.json({
        error: `Committed locally but push failed: ${pushErr.slice(0, 200)}`,
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Pushed to GitHub' })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to sync')
  }
}
