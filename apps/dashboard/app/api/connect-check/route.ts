import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { getConnectStore } from '@/lib/connect-store'
import { dispatchConnectCheck, readConnectCheck } from '@/lib/connect-check-server'

// Post-connect "Test connection".
//   POST { harness }   -> dispatch the connect-check skill, { dispatchId }
//   GET ?harness=&id=  -> that dispatch's state; without id, the newest
//                         connect-check run for the harness (onboarding card).
// Pass = run succeeded AND model usage > 0 (lib/connect-check.ts).
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const body = (await request.json().catch(() => ({}))) as { harness?: unknown }
    const harness = typeof body.harness === 'string' ? body.harness : ''
    if (!harness) return NextResponse.json({ error: 'harness is required' }, { status: 400 })
    return NextResponse.json(await dispatchConnectCheck(getConnectStore(), harness))
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to start the connection test')
  }
}

export async function GET(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const params = new URL(request.url).searchParams
    const harness = params.get('harness') || ''
    const id = params.get('id') || undefined
    if (!harness) return NextResponse.json({ error: 'harness is required' }, { status: 400 })
    return NextResponse.json(await readConnectCheck(getConnectStore(), harness, id))
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to read the connection test')
  }
}
