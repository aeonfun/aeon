import { NextResponse } from 'next/server'
import { getFileContent, updateFile, createFile, commitAndPush } from '@/lib/github'

// The two operator-editable soul files. examples/ and data/ are populated by the
// soul-builder skill, not hand-edited here, so the tab edits just these two.
const FILES = { soul: 'soul/SOUL.md', style: 'soul/STYLE.md' } as const
type FileKey = keyof typeof FILES

async function read(path: string): Promise<{ content: string; exists: boolean }> {
  try {
    const { content } = await getFileContent(path)
    return { content, exists: true }
  } catch {
    return { content: '', exists: false }
  }
}

export async function GET() {
  const [soul, style] = await Promise.all([read(FILES.soul), read(FILES.style)])
  return NextResponse.json({ soul, style })
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { file?: string; content?: string }
    const key = body.file as FileKey
    if (key !== 'soul' && key !== 'style') {
      return NextResponse.json({ error: "file must be 'soul' or 'style'" }, { status: 400 })
    }
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content (string) required' }, { status: 400 })
    }
    const path = FILES[key]

    // GitHub's API needs the current sha to update; create it when absent.
    // (Local mode ignores the sha.)
    let sha = ''
    try {
      sha = (await getFileContent(path)).sha
    } catch {
      // new file
    }
    if (sha) {
      await updateFile(path, body.content, sha, `chore: update ${path} from dashboard`)
    } else {
      await createFile(path, body.content, `chore: add ${path} from dashboard`)
    }
    const sync = commitAndPush([path], `chore: update ${path} from dashboard`)
    return NextResponse.json({ ok: true, synced: sync.synced, ...(sync.reason ? { syncError: sync.reason } : {}) })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
