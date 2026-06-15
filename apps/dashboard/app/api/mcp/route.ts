import { NextResponse } from 'next/server'
import { getFileContent, updateFile, createFile, commitAndPush } from '@/lib/github'
import { errorResponse, syncResult } from '@/lib/http'
import type { McpServers } from '@/lib/types'

const FILE = '.mcp.json'

export async function GET() {
  try {
    const { content, sha } = await getFileContent(FILE)
    let servers: McpServers = {}
    try {
      const parsed = JSON.parse(content) as { mcpServers?: McpServers }
      servers = parsed.mcpServers ?? {}
    } catch (e) {
      // Malformed JSON - return raw so the operator can see/fix it, and log so
      // the broken file isn't indistinguishable from an empty server list.
      console.warn(`[mcp] .mcp.json is not valid JSON; returning raw for repair: ${e instanceof Error ? e.message : e}`)
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
    return NextResponse.json(syncResult(sync))
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
