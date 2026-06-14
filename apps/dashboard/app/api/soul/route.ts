import { NextResponse } from 'next/server'
import { getFileContent, saveFile } from '@/lib/github'
import { errorResponse, syncResult } from '@/lib/http'

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

    const sync = await saveFile(path, body.content, {
      updateMsg: `chore: update ${path} from dashboard`,
      createMsg: `chore: add ${path} from dashboard`,
    })
    return NextResponse.json(syncResult(sync))
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
