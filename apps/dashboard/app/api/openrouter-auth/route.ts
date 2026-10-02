import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { getConnectStore } from '@/lib/connect-store'
import { ghArgsRepo } from '@/lib/gh'
import { flowStatus, startFlow } from '@/lib/openrouter-oauth'

// One-click OpenRouter (an option next to paste-a-key, never the default).
//   POST { harness }  -> { url, state }: the browser opens `url` in a popup.
//   GET ?state=       -> pending | done | error, polled by the modal in case
//                        the popup cannot postMessage back.
// The callback (./callback) exchanges the code and saves OPENROUTER_API_KEY.
// See lib/openrouter-oauth.ts.
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const body = (await request.json().catch(() => ({}))) as { harness?: unknown }
    const harness = typeof body.harness === 'string' && /^[a-z]+$/.test(body.harness) ? body.harness : 'claude'
    const origin = request.headers.get('origin') || new URL(request.url).origin
    const repo = ghArgsRepo()[1]
    const label = `Aeon${repo ? ` (${repo})` : ''}`
    return NextResponse.json(await startFlow(getConnectStore(), { origin, harness, label }))
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to start OpenRouter connect')
  }
}

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get('state') || ''
  const status = state ? await flowStatus(getConnectStore(), state) : null
  return NextResponse.json(status ?? { status: 'error', error: 'Unknown or expired request' })
}
