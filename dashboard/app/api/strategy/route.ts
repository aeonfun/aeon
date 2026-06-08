import { NextResponse } from 'next/server'
import { getFileContent, updateFile, createFile } from '@/lib/github'

const FILE = 'STRATEGY.md'

export async function GET() {
  try {
    const { content, sha } = await getFileContent(FILE)
    return NextResponse.json({ exists: true, content, sha })
  } catch {
    // Not created yet — the editor can bootstrap it on first save.
    return NextResponse.json({ exists: false, content: '', sha: '' })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { content?: string }
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content (string) required' }, { status: 400 })
    }

    // GitHub's API needs the current sha to update an existing file; when the
    // file doesn't exist yet, create it instead. (Local mode ignores the sha.)
    let sha = ''
    try {
      sha = (await getFileContent(FILE)).sha
    } catch {
      // new file
    }
    if (sha) {
      await updateFile(FILE, body.content, sha, 'chore: update STRATEGY.md from dashboard')
    } else {
      await createFile(FILE, body.content, 'chore: add STRATEGY.md from dashboard')
    }
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
