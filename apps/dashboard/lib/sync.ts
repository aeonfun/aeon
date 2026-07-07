import { execSync } from 'child_process'
import { REPO_ROOT } from './gh'

function git(cmd: string) {
  return execSync(cmd, { stdio: 'pipe', cwd: REPO_ROOT }).toString().trim()
}

export interface SyncStatus { hasChanges: boolean; changedFiles: number; behind: number }

// Working-tree status plus how far behind origin/main the local repo is. Shared by
// GET /api/sync and `aeon sync --status`. A failed fetch (offline/no remote) leaves
// `behind` at 0 but is logged, not swallowed as "in sync".
export function syncStatus(): SyncStatus {
  const status = git('git status --porcelain')
  const hasChanges = status.length > 0
  const changedFiles = hasChanges ? status.split('\n').length : 0
  let behind = 0
  try {
    git('git fetch origin main')
    behind = parseInt(git('git rev-list --count HEAD..origin/main')) || 0
  } catch (e) {
    console.warn(`[sync] git fetch failed; "behind" count may be stale: ${e instanceof Error ? e.message : e}`)
  }
  return { hasChanges, changedFiles, behind }
}

export type SyncPush =
  | { ok: true; message: string }
  | { ok: false; error: string }

// Stage everything, commit, and push to origin. Shared by POST /api/sync and
// `aeon sync`. Distinguishes "nothing to commit" (ok) from a real commit failure,
// and a local-commit-but-push-failed (surfaced) — same semantics as the route.
export function syncPush(): SyncPush {
  const status = git('git status --porcelain')
  if (!status) return { ok: true, message: 'Already in sync' }

  git('git add -A')

  try {
    git('git commit -m "chore: update config from CLI"')
  } catch (e: unknown) {
    const io = e as { stdout?: unknown; stderr?: unknown }
    const detail = `${e instanceof Error ? e.message : ''} ${io?.stdout ?? ''} ${io?.stderr ?? ''}`
    if (/nothing to commit/i.test(detail)) return { ok: true, message: 'Nothing to commit' }
    throw e
  }

  try {
    git('git push')
  } catch (e: unknown) {
    const pushErr = e instanceof Error ? e.message : 'Push failed'
    return { ok: false, error: `Committed locally but push failed: ${pushErr.slice(0, 200)}` }
  }

  return { ok: true, message: 'Pushed to GitHub' }
}
