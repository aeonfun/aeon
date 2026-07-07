import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { listRuns } from '@/lib/runs'

// The Aeon-run filter and gh shaping live in lib/runs.ts so `aeon runs ls` and
// this route return identical data.
export async function GET() {
  try {
    return NextResponse.json({ runs: listRuns() })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to list runs')
  }
}
