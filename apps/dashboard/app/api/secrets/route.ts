import { NextResponse } from 'next/server'
import { ghAvailable } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import { getSecrets, setSecret, deleteSecret, VALID_SECRET_NAME } from '@/lib/secrets-catalog'

// The credential catalog (BUILTIN_SECRETS), VALID_SECRET_NAME, the set-state read,
// and the set/delete side-effects (gateway re-sync, Telegram menu re-register) all
// live in lib/secrets-catalog.ts so the `aeon secrets` CLI command and this route
// share one definition. This route is now a thin HTTP wrapper.

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
  if (!VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name - use UPPER_SNAKE_CASE' }, { status: 400 })
  }

  try {
    await setSecret(name, value)
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
    await deleteSecret(name)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to delete secret')
  }
}
