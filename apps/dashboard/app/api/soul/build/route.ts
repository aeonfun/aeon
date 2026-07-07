import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { buildSoul } from '@/lib/builders'
import type { SoulSources } from '@/lib/types'

// The input normalizers + gh dispatch live in lib/builders.ts so `aeon soul build`
// and this route compose the brief identically.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SoulSources> & { model?: string }
    const { sources } = buildSoul(body, { dispatch: true })
    return NextResponse.json({ ok: true, sources })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (/at least one valid source/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 })
    return errorResponse(error, 'Failed to dispatch soul-builder')
  }
}
