import { NextResponse } from 'next/server'
import { listTopics } from '@/lib/memory'
import { errorResponse } from '@/lib/http'

export async function GET() {
  try {
    const topics = await listTopics()
    return NextResponse.json({ count: topics.length, topics })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to list topics')
  }
}
