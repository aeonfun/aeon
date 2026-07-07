import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { buildStrategy } from '@/lib/builders'
import type { StrategySources } from '@/lib/types'

// The input normalizers + gh dispatch live in lib/builders.ts so `aeon strategy
// build` and this route compose the brief identically.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StrategySources> & { model?: string }
    const { brief } = buildStrategy(body, { dispatch: true })
    return NextResponse.json({ ok: true, brief })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (/at least one input/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 })
    return errorResponse(error, 'Failed to dispatch strategy-builder')
  }
}
