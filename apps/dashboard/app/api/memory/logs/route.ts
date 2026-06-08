import { NextResponse } from 'next/server'
import { listLogs, readLog } from '@/lib/memory'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')

    if (date) {
      const log = await readLog(date)
      if (!log) {
        return NextResponse.json(
          { error: `No log found for ${date} (expected YYYY-MM-DD)` },
          { status: 404 },
        )
      }
      return NextResponse.json(log)
    }

    const logs = await listLogs()
    return NextResponse.json({ count: logs.length, logs })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to read logs'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
