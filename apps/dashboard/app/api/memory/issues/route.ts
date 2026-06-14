import { NextResponse } from 'next/server'
import { listIssues } from '@/lib/memory'
import { errorResponse } from '@/lib/http'

export async function GET() {
  try {
    const issues = await listIssues()
    return NextResponse.json({ count: issues.length, issues })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to list issues')
  }
}
