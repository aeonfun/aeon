import { NextResponse } from 'next/server'
import { readIssue } from '@/lib/memory'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const issue = await readIssue(id)
    if (!issue) {
      return NextResponse.json(
        { error: `No issue found for id '${id}' (expected format: ISS-NNN)` },
        { status: 404 },
      )
    }
    return NextResponse.json(issue)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to read issue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
