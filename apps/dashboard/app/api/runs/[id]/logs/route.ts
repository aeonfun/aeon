import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/http'
import { getRunLogs } from '@/lib/runs'

// The gh log-fetch, Run-step extraction, and Summary parsing live in lib/runs.ts
// so `aeon runs logs <id>` and this route return identical data.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 })
    }
    return NextResponse.json(getRunLogs(id))
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to fetch logs')
  }
}
