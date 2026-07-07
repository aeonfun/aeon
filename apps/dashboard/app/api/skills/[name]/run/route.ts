import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { runSkill } from '@/lib/run-skill'

// The name validation, var/model sanitization, install-skill PR-permission
// guarantee, and gh dispatch live in lib/run-skill.ts so `aeon skills run` and
// this route dispatch identically.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params

    let skillVar = ''
    let model = ''
    try {
      const body = await request.json() as { var?: string; model?: string }
      if (typeof body.var === 'string') skillVar = body.var
      if (typeof body.model === 'string') model = body.model
    } catch { /* no body is fine */ }

    runSkill(name, { var: skillVar, model })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    // An invalid skill name is a client error, not a dispatch failure.
    if (/Invalid skill name/.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return errorResponse(error, 'Failed to trigger run')
  }
}
