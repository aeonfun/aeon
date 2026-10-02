import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT, ghArgsRepo } from '@/lib/gh'
import { isLocal } from '@/lib/github'

// GET /api/onboarding -> { actionsEnabled } for the HQ setup checklist. The
// rest of the checklist (repo, model key, notifications, first run) is derived
// on the client from data it already has. Local mode asks GitHub through gh;
// null means "could not tell" (no gh, no admin read, or hosted mode), which the
// card shows as unknown instead of failed.
export async function GET() {
  let actionsEnabled: boolean | null = null
  if (isLocal()) {
    const repo = ghArgsRepo()[1]
    if (repo) {
      try {
        const out = execFileSync('gh', ['api', `repos/${repo}/actions/permissions`, '-q', '.enabled'], { stdio: 'pipe', cwd: REPO_ROOT, timeout: 15_000 }).toString().trim()
        actionsEnabled = out === 'true' ? true : out === 'false' ? false : null
      } catch { /* leave unknown */ }
    }
  }
  return NextResponse.json({ actionsEnabled })
}
