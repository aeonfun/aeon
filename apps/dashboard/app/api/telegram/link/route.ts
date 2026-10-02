import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { getConnectStore } from '@/lib/connect-store'
import { startLink } from '@/lib/telegram-link'

// POST /api/telegram/link { token } -> { username, nonce, link }. Step 1 of
// the no-copy-paste chat id: the operator taps link (t.me/<bot>?start=<nonce>),
// then ./check polls for that /start and saves TELEGRAM_CHAT_ID. The token is
// passed in because GitHub secrets are write-only; it is used for these calls
// and never stored. See lib/telegram-link.ts.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown }
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })
    return NextResponse.json(await startLink(getConnectStore(), token))
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to reach Telegram', 400)
  }
}
