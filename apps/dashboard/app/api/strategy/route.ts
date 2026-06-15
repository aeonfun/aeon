import { NextResponse } from 'next/server'
import { getFileContent, saveFile } from '@/lib/github'
import { errorResponse, syncResult } from '@/lib/http'

const FILE = 'STRATEGY.md'

export async function GET() {
  try {
    const { content, sha } = await getFileContent(FILE)
    return NextResponse.json({ exists: true, content, sha })
  } catch {
    // Not created yet - the editor can bootstrap it on first save.
    return NextResponse.json({ exists: false, content: '', sha: '' })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { content?: string }
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content (string) required' }, { status: 400 })
    }

    const sync = await saveFile(FILE, body.content, {
      updateMsg: 'chore: update STRATEGY.md from dashboard',
      createMsg: 'chore: add STRATEGY.md from dashboard',
    })
    return NextResponse.json(syncResult(sync))
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
