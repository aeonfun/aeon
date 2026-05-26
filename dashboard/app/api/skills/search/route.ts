// dashboard/app/api/skills/search/route.ts
//
// Skill-discovery search endpoint (Session 06).
// Wraps scripts/skill-search.mjs over HTTP — same engine as MCP/A2A.
//
// Usage:
//   GET /api/skills/search?q=<query>&limit=<N>&tag=<tag>
//
// Returns: { query, provider, results: [{ slug, name, description, tags, score, invoke_as }] }
//
// Inside the Sealed Sprint the embedding provider is `mock` (deterministic, no
// network). Results are NOT semantically meaningful until the repo owner regenerates
// the index with --provider openai (or workers) post-seal.
//
// Protected by the standard dashboard middleware (loopback host gate + CSRF check).

import { NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { resolve, join } from 'path'

const REPO_ROOT = resolve(process.cwd(), '..')

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const query = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') ?? '5', 10)))
  const tag = (url.searchParams.get('tag') ?? '').trim()

  if (!query) {
    return NextResponse.json(
      { error: 'query parameter `q` is required' },
      { status: 400 }
    )
  }

  // Whitelist tag against the fixed taxonomy.
  const ALLOWED_TAGS = new Set(['', 'content', 'crypto', 'dev', 'meta', 'news', 'research', 'social'])
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { error: `tag must be one of: ${[...ALLOWED_TAGS].filter(Boolean).join(', ')}` },
      { status: 400 }
    )
  }

  const scriptPath = join(REPO_ROOT, 'scripts', 'skill-search.mjs')

  const result = spawnSync('node', [scriptPath], {
    env: {
      ...process.env,
      AEON_ROOT: REPO_ROOT,
      QUERY: query,
      LIMIT: String(limit),
      TAG_FILTER: tag,
      FORMAT: 'json',
    },
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    encoding: 'utf8',
  })

  if (result.error) {
    return NextResponse.json(
      { error: `skill-search spawn failed: ${result.error.message}` },
      { status: 500 }
    )
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    // Common case: missing index file. Help the operator.
    if (stderr.includes('not found') && stderr.includes('skills-index.json')) {
      return NextResponse.json(
        { error: 'docs/skills-index.json missing. Run `./index-skills` to generate.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: `skill-search exited ${result.status}: ${stderr}` },
      { status: 500 }
    )
  }

  try {
    const data = JSON.parse(result.stdout)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `skill-search produced invalid JSON: ${(e as Error).message}` },
      { status: 500 }
    )
  }
}
