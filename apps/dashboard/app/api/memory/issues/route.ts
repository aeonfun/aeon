import { NextResponse } from 'next/server'
import { listIssues } from '@/lib/memory'

export async function GET() {
  try {
    const issues = await listIssues()
    return NextResponse.json({ count: issues.length, issues })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list issues'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
