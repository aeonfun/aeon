import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
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

    const args = ['workflow', 'run', 'aeon.yml', '-f', `skill=${name}`]
    if (skillVar) args.push('-f', `var=${skillVar}`)
    if (model) args.push('-f', `model=${model}`)

    execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to trigger run')
  }
}
