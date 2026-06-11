import { NextResponse } from 'next/server'
import { getFileContent, updateFile, createFile, commitAndPush } from '@/lib/github'

const FILE = '.mcp.json'

type McpServers = Record<string, unknown>

export async function GET() {
  try {
    const { content, sha } = await getFileContent(FILE)
    let servers: McpServers = {}
    try {
      const parsed = JSON.parse(content) as { mcpServers?: McpServers }
      servers = parsed.mcpServers ?? {}
    } catch {
      // Malformed JSON — return raw so the operator can see/fix it.
    }
    return NextResponse.json({ exists: true, servers, sha, raw: content })
  } catch {
    return NextResponse.json({ exists: false, servers: {}, sha: '', raw: '' })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { servers?: McpServers }
    if (!body.servers || typeof body.servers !== 'object' || Array.isArray(body.servers)) {
      return NextResponse.json({ error: 'servers (object) required' }, { status: 400 })
    }
    const content = JSON.stringify({ mcpServers: body.servers }, null, 2) + '\n'
    let sha = ''
    try {
      sha = (await getFileContent(FILE)).sha
    } catch {
      // new file
    }
    if (sha) {
      await updateFile(FILE, content, sha, 'chore: update .mcp.json from dashboard')
    } else {
      await createFile(FILE, content, 'chore: add .mcp.json from dashboard')
    }
    const sync = commitAndPush([FILE], 'chore: update .mcp.json from dashboard')
    return NextResponse.json({ ok: true, synced: sync.synced, ...(sync.reason ? { syncError: sync.reason } : {}) })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
