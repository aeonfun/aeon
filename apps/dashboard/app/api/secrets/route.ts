import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { ghAvailable, ghArgsRepo, dispatchCommandsWorkflow } from '@/lib/gh'
import { syncGatewayProvider } from '@/lib/gateway'
import { errorResponse } from '@/lib/http'
import { GATEWAY_SECRET_NAMES } from '@/lib/gateway-registry'
import { getSecrets, VALID_SECRET_NAME } from '@/lib/secrets-catalog'

// The credential catalog (BUILTIN_SECRETS), its name index, VALID_SECRET_NAME,
// and the set-state read live in lib/secrets-catalog.ts so the `aeon secrets`
// CLI command and this route share one definition. This route keeps the
// write path plus the gateway/telegram side-effects that only make sense here.

export async function GET() {
  const { secrets, ghReady } = getSecrets()
  if (!ghReady) {
    return NextResponse.json({
      error: 'GitHub CLI not authenticated. Run: gh auth login',
      ghReady: false,
    }, { status: 503 })
  }
  return NextResponse.json({ secrets, ghReady: true })
}

export async function POST(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name, value } = await request.json() as { name?: string; value?: string }

  if (!name || !value) {
    return NextResponse.json({ error: 'name and value required' }, { status: 400 })
  }

  // Allow any valid env var name (builtins + custom)
  if (!VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name - use UPPER_SNAKE_CASE' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'set', name, ...ghArgsRepo(), '-b', value], {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    // Keep routing on `auto` so the workflow resolves the provider at run time
    // from whichever keys are set (scripts/llm-gateway.sh) - no per-key pinning.
    if (GATEWAY_SECRET_NAMES.includes(name)) await syncGatewayProvider()
    // Auto-register the Telegram slash-command menu the moment the bot token lands,
    // so the operator never has to run the workflow by hand for the first setup.
    // Best-effort: a dispatch hiccup must not fail the secret save (the manual
    // "Re-register" button and the aeon.yml push trigger are the fallbacks).
    if (name === 'TELEGRAM_BOT_TOKEN') {
      try { dispatchCommandsWorkflow() } catch { /* non-fatal — token is still saved */ }
    }
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to set secret')
  }
}

export async function DELETE(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name } = await request.json() as { name?: string }

  if (!name || !VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'delete', name, ...ghArgsRepo()], { stdio: 'pipe', cwd: process.cwd() })
    // Stay on `auto`: dropping a key just makes run-time resolution fall through
    // to the next provider whose secret is still set (or `direct`).
    if (GATEWAY_SECRET_NAMES.includes(name)) await syncGatewayProvider()
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to delete secret')
  }
}
