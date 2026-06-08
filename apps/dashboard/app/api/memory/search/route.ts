import { NextResponse } from 'next/server'
import { searchMemory, type SearchHit } from '@/lib/memory'

const VALID_SOURCES: SearchHit['source'][] = ['memory', 'topic', 'log', 'issue']

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json(
        { error: 'Missing required query parameter: q' },
        { status: 400 },
      )
    }

    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Math.max(1, Math.min(parseInt(limitRaw, 10) || 20, 100)) : 20

    const sourcesParam = url.searchParams.get('sources')
    const sources = sourcesParam
      ? sourcesParam
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter((s): s is SearchHit['source'] => (VALID_SOURCES as string[]).includes(s))
      : undefined

    const hits = await searchMemory(q, { limit, sources })

    return NextResponse.json({
      query: q,
      count: hits.length,
      sources: sources ?? VALID_SOURCES,
      hits,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
