import { NextResponse } from 'next/server'
import { detect } from '@/lib/connect-server'

// POST /api/connect/detect { harness, value, provider? } - preview only, saves
// nothing. The browser detects keys itself; it calls this for login captures,
// which have to be gunzipped and listed to know which login they hold.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { harness?: unknown; value?: unknown; provider?: unknown }
  const harness = typeof body.harness === 'string' ? body.harness : ''
  const value = typeof body.value === 'string' ? body.value : ''
  const provider = typeof body.provider === 'string' ? body.provider : ''
  return NextResponse.json({ detection: detect(value, harness, provider).detection })
}
