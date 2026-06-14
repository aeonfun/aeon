import { NextResponse } from 'next/server'
import { readIssue } from '@/lib/memory'
import { errorResponse } from '@/lib/http'

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
    return errorResponse(error, 'Failed to read issue')
  }
}
