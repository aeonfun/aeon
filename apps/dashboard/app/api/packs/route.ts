import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { getPacks } from '@/lib/packs'

// The first-party + community pack join lives in lib/packs.ts so `aeon packs ls`
// and this route return identical data.
//
// No PATCH: a pack is a lens for browsing/grouping, not a bulk switch. Skills are
// enabled individually via PATCH /api/skills (the per-skill toggle).
export async function GET() {
  try {
    return NextResponse.json(await getPacks())
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
