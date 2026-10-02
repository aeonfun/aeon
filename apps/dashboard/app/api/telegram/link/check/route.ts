import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { getConnectStore } from '@/lib/connect-store'
import { setSecret } from '@/lib/secrets-catalog'
import { checkLink } from '@/lib/telegram-link'

// POST /api/telegram/link/check { token, nonce } -> waiting | found | webhook |
// expired. Reads getUpdates WITHOUT an offset (so nothing is consumed for the
// messages.yml poller) looking for "/start <nonce>"; on a hit it saves the chat
// as TELEGRAM_CHAT_ID and says hello in that chat. `webhook` (HTTP 409) means
// the bot is in webhook mode: the UI falls back to the manual helper.
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const body = (await request.json().catch(() => ({}))) as { token?: unknown; nonce?: unknown }
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const nonce = typeof body.nonce === 'string' ? body.nonce : ''
    if (!token || !nonce) return NextResponse.json({ error: 'token and nonce are required' }, { status: 400 })

    const result = await checkLink(getConnectStore(), token, nonce)
    if (result.status === 'found') {
      await setSecret('TELEGRAM_CHAT_ID', result.chatId)
      // Best-effort confirmation in the chat itself.
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: result.chatId, text: 'Aeon is linked to this chat. Notifications will arrive here.' }),
      }).catch(() => {})
    }
    return NextResponse.json(result)
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to check Telegram')
  }
}
