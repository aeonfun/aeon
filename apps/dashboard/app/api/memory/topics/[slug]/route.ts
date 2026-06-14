import { NextResponse } from 'next/server'
import { readTopic } from '@/lib/memory'
import { errorResponse } from '@/lib/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const topic = await readTopic(slug)
    if (!topic) {
      return NextResponse.json(
        { error: `No topic found for slug '${slug}'` },
        { status: 404 },
      )
    }
    return NextResponse.json(topic)
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to read topic')
  }
}
