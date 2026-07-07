import { NextResponse } from 'next/server'
import { ghAvailable } from '@/lib/gh'
import { configureAuth } from '@/lib/auth'

// The auth normalization, gh secret/variable writes, and `claude setup-token`
// OAuth flow live in lib/auth.ts so `aeon auth` and this route configure auth
// identically.
export async function POST(request: Request) {
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }
    const body = await request.json().catch(() => ({})) as { key?: string, baseUrl?: string, provider?: string }
    return NextResponse.json(await configureAuth(body))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to setup auth'
    const status = msg.includes('Base URL') || msg.includes('OAuth tokens') || msg.includes('gateway') || msg.includes('extract') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
