import { NextResponse } from 'next/server'
import { listLogs, listTopics, listIssues, readMemoryIndex } from '@/lib/memory'

export async function GET() {
  try {
    const [memory, topics, logs, issues] = await Promise.all([
      readMemoryIndex(),
      listTopics(),
      listLogs(),
      listIssues(),
    ])

    return NextResponse.json({
      memory: memory
        ? { exists: true, size: memory.length, excerpt: memory.slice(0, 400) }
        : { exists: false },
      counts: {
        topics: topics.length,
        logs: logs.length,
        issues: issues.length,
      },
      latestLog: logs[0]?.date ?? null,
      routes: [
        { path: '/api/memory', description: 'Index: counts and MEMORY.md excerpt' },
        { path: '/api/memory/search?q=', description: 'Full-text search across memory, topics, logs, issues' },
        { path: '/api/memory/logs', description: 'List all daily log dates' },
        { path: '/api/memory/logs?date=YYYY-MM-DD', description: 'Fetch one daily log' },
        { path: '/api/memory/topics', description: 'List all topic files' },
        { path: '/api/memory/topics/[slug]', description: 'Fetch one topic file' },
        { path: '/api/memory/issues', description: 'List open/resolved issue tracker entries' },
        { path: '/api/memory/issues/[id]', description: 'Fetch one issue (e.g. ISS-001)' },
      ],
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
