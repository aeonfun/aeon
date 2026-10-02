import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { isLocal } from '@/lib/github'
import { ConnectInputError, connectFound, listFound } from '@/lib/connect-server'

// "Found on this machine" (local mode only). GET lists existing CLI logins and
// model keys in the dashboard's environment that could connect ?harness=, by
// name only. POST { id, harness } captures one server-side and saves it, so the
// value never reaches the browser. `local` also tells the modal whether to show
// the other machine-bound extras ("Do it for me"). Loopback-only via proxy.ts,
// like every /api route.
export async function GET(request: Request) {
  const harness = new URL(request.url).searchParams.get('harness') || 'claude'
  const local = isLocal()
  return NextResponse.json({ local, items: local ? listFound(harness) : [] })
}

export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; harness?: unknown }
    const id = typeof body.id === 'string' ? body.id : ''
    const harness = typeof body.harness === 'string' ? body.harness : ''
    if (!id || !harness) return NextResponse.json({ error: 'id and harness are required' }, { status: 400 })
    return NextResponse.json(await connectFound(id, harness))
  } catch (error: unknown) {
    if (error instanceof ConnectInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    return errorResponse(error, 'Failed to use the found credential')
  }
}
