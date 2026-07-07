import { NextResponse } from 'next/server'
import { getRemoteDirectory, getRemoteFileContent, createFile, commitAndPush } from '@/lib/github'
import { errorResponse, syncFields } from '@/lib/http'
import { displayName } from '@/lib/utils'
import type { SoulExample, SoulExamplesResponse } from '@/lib/types'

// One-click install of a ready-made soul from the soul.md examples gallery into
// the operator's own repo. GET lists the available example people; POST copies
// one example's SOUL.md / STYLE.md / voice examples into soul/ and commits.
const SOURCE_REPO = 'aaronjmars/soul.md'

// Short blurbs for the known examples; unknown ones still list with just a name.
const BLURBS: Record<string, string> = {
  karpathy: 'AI researcher & educator - builds from scratch, Software 2.0',
  'garry-tan': 'YC president - founder-first, optimistic, direct',
  steipete: 'Indie Apple-platform dev - sharp, technical, opinionated',
  'vivian-balakrishnan': "Singapore's foreign minister - measured, statesmanlike",
}

export async function GET() {
  try {
    const entries = await getRemoteDirectory(SOURCE_REPO, 'examples')
    const examples: SoulExample[] = entries
      .filter(e => e.type === 'dir' && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map(d => ({ key: d.name, label: displayName(d.name), blurb: BLURBS[d.name] || '' }))
    return NextResponse.json({ examples } satisfies SoulExamplesResponse)
  } catch {
    return NextResponse.json({ examples: [] } satisfies SoulExamplesResponse)
  }
}

export async function POST(request: Request) {
  try {
    const { example } = (await request.json()) as { example?: string }
    if (typeof example !== 'string' || !/^[a-z0-9-]+$/.test(example)) {
      return NextResponse.json({ error: 'Invalid example name' }, { status: 400 })
    }

    const base = `examples/${example}`
    const soul = await getRemoteFileContent(SOURCE_REPO, `${base}/SOUL.md`)
    if (!soul) {
      return NextResponse.json({ error: `Example "${example}" not found` }, { status: 404 })
    }
    const style = await getRemoteFileContent(SOURCE_REPO, `${base}/STYLE.md`)
    const good = await getRemoteFileContent(SOURCE_REPO, `${base}/examples/good-outputs.md`)

    const msg = `chore: install ${example} soul example from soul.md`
    const paths = ['soul/SOUL.md']
    // createFile overwrites-or-creates in both local and hosted modes.
    await createFile('soul/SOUL.md', soul, msg)
    if (style) { await createFile('soul/STYLE.md', style, msg); paths.push('soul/STYLE.md') }
    if (good) { await createFile('soul/examples/good-outputs.md', good, msg); paths.push('soul/examples/good-outputs.md') }

    const sync = commitAndPush(paths, msg)
    return NextResponse.json({ ok: true, soul, style: style || '', ...syncFields(sync) })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to install example')
  }
}
