import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT, ensureActionsCanOpenPRs } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import { sanitizeModel } from '@/lib/dispatch'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params

    // Validate skill name to prevent injection
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
    }

    // Read optional var and model from request body
    let skillVar = ''
    let model = ''
    try {
      const body = await request.json() as { var?: string; model?: string }
      if (body.var && typeof body.var === 'string') {
        skillVar = body.var.replace(/[^a-zA-Z0-9_ .\-/#@]/g, '')
      }
      if (body.model && typeof body.model === 'string') {
        model = sanitizeModel(body.model)
      }
    } catch { /* no body is fine */ }

    // install-skill installs a community pack and ships it as an auto-merged PR
    // — which the in-Actions GITHUB_TOKEN can only do if this repo's Actions
    // PR-creation setting is on. It isn't on a fresh fork and doesn't inherit,
    // so guarantee it from the operator's (admin) local gh before dispatching.
    if (name === 'install-skill') ensureActionsCanOpenPRs()

    const args = ['workflow', 'run', 'aeon.yml', '-f', `skill=${name}`]
    if (skillVar) args.push('-f', `var=${skillVar}`)
    if (model) args.push('-f', `model=${model}`)

    execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to trigger run')
  }
}
