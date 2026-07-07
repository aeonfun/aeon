import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { syncStatus, syncPush } from '@/lib/sync'

// The git status/commit/push logic lives in lib/sync.ts so `aeon sync` and this
// route behave identically.
export async function GET() {
  try {
    const { hasChanges, changedFiles, behind } = syncStatus()
    return NextResponse.json({ hasChanges, changedFiles, behind })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to check status')
  }
}

export async function POST() {
  try {
    const result = syncPush()
    if (result.ok) return NextResponse.json({ ok: true, message: result.message })
    return NextResponse.json({ error: result.error }, { status: 500 })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to sync')
  }
}
