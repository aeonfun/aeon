import { NextResponse } from 'next/server'
import { requireGh, errorResponse } from '@/lib/http'
import { captureGithubToken, GhGlobalScopeError } from '@/lib/github-auth'

// POST /api/github-auth - copy this machine's `gh auth token` into the
// GH_GLOBAL repo secret. Parallel to POST /api/auth (Claude) and
// POST /api/grok-auth, minus a browser flow: gh is already authenticated
// or the dashboard would have 503'd. A token without repo + workflow (or a
// fine-grained one that cannot be checked) is refused with a 400.
export async function POST() {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    return NextResponse.json(captureGithubToken())
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (error instanceof GhGlobalScopeError || msg.includes('Could not read') || msg.includes('not authenticated')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return errorResponse(error, 'Failed to connect GitHub')
  }
}
