import { execSync } from 'child_process'
import { resolve } from 'path'

// The dashboard runs from apps/dashboard/; the repo it manages is two levels up.
export const REPO_ROOT = resolve(process.cwd(), '..', '..')

// Whether the `gh` CLI is installed and authenticated.
export function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// Resolve the active repo: explicit `gh` default first, inferred remote second.
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

// `-R owner/repo` args for `gh` subcommands, or empty when the repo is unresolved.
export function ghArgsRepo(): string[] {
  const repo = ghRepo()
  return repo ? ['-R', repo] : []
}
