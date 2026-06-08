import { NextResponse } from 'next/server'
import { readTopic } from '@/lib/memory'

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
    const msg = error instanceof Error ? error.message : 'Failed to read topic'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
