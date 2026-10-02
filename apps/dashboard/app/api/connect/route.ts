import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { ConnectInputError, saveConnection } from '@/lib/connect-server'

// POST /api/connect { harness, value, provider? } - the Connect modal's single
// save path. Detects what was pasted (key, setup-token, or base64 login
// capture), stores it under the right secret, and for a login capture switches
// aeon.yml to that harness. See lib/connect-detect.ts for the rules.
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const body = (await request.json().catch(() => ({}))) as { harness?: unknown; value?: unknown; provider?: unknown }
    const harness = typeof body.harness === 'string' ? body.harness : ''
    const value = typeof body.value === 'string' ? body.value : ''
    const provider = typeof body.provider === 'string' ? body.provider : ''
    if (!harness || !value.trim()) return NextResponse.json({ error: 'harness and value are required' }, { status: 400 })
    return NextResponse.json(await saveConnection({ harness, value, provider }))
  } catch (error: unknown) {
    if (error instanceof ConnectInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    return errorResponse(error, 'Failed to save the credential')
  }
}
