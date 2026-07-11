import { NextResponse } from 'next/server'
import { dispatchCommandsWorkflow } from '@/lib/gh'
import { errorResponse, requireGh } from '@/lib/http'

// Re-register the Telegram slash-command menu. Dispatches the Setup Telegram
// Commands workflow, which reads TELEGRAM_BOT_TOKEN server-side and calls
// setMyCommands + setChatMenuButton — no token pasting from the browser. Commands
// also auto-register the moment the bot token is saved (see /api/secrets); this
// route is the manual "re-sync after toggling skills" path behind the dashboard button.
export async function POST() {
  const notReady = requireGh()
  if (notReady) return notReady
  try {
    dispatchCommandsWorkflow()
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to start the command-registration workflow')
  }
}
