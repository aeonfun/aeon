import { NextResponse } from 'next/server'
import { errorResponse, requireGh } from '@/lib/http'
import { getConnectStore } from '@/lib/connect-store'
import { readRunDiagnosis } from '@/lib/run-diagnosis-server'

// Why a failed or timed-out run ended that way, in plain words, with the next
// step (lib/run-diagnosis.ts). HQ asks only when a run is opened.
//   GET -> { diagnosis }  (null while running, or when the run did not fail)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady
    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 })
    }
    return NextResponse.json({ diagnosis: await readRunDiagnosis(getConnectStore(), id) })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to read the run')
  }
}
