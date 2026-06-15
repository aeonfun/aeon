import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import { isRecord } from '@/lib/utils'
import type { SkillOutput } from '@/lib/types'

const OUTPUTS_DIR = join(process.cwd(), 'outputs')

// A json-render spec must at least name a root element and carry an elements
// map. Element props are intentionally loose (SpecNode coerces per-field
// downstream), so don't validate beyond the container shape here.
function isSpec(v: unknown): v is SkillOutput['spec'] {
  return isRecord(v) && typeof v.root === 'string' && isRecord(v.elements)
}

// Filenames stamp time as 2026-06-12T14-30-00Z (colons are illegal in paths).
// Convert back to ISO 2026-06-12T14:30:00Z so `new Date()` can parse it —
// otherwise the feed renders "NaNd ago".
function fileTsToIso(ts: string): string {
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/)
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z` : ts
}

export async function GET() {
  try {
    const files = await readdir(OUTPUTS_DIR).catch(() => [] as string[])
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort((a, b) => {
      // Extract timestamp from filename: <skill>-<YYYY-MM-DDTHH-MM-SSZ>.json
      const tsA = a.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || ''
      const tsB = b.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || ''
      return tsB.localeCompare(tsA) // newest first
    })

    const outputs = await Promise.all(
      jsonFiles.slice(0, 100).map(async (filename) => {
        try {
          const raw = await readFile(join(OUTPUTS_DIR, filename), 'utf-8')
          const spec = JSON.parse(raw) as unknown
          // Skip specs missing root/elements - they render empty downstream
          // anyway, so drop them at the source instead of emitting a broken item.
          if (!isSpec(spec)) return null
          // Parse skill name and timestamp from filename: <skill>-<timestamp>.json
          const base = filename.replace('.json', '')
          const tsMatch = base.match(/^(.+?)-(\d{4}-\d{2}-\d{2}T.+Z)$/)
          return {
            filename,
            skill: tsMatch ? tsMatch[1] : base,
            timestamp: tsMatch ? fileTsToIso(tsMatch[2]) : '',
            spec,
          }
        } catch {
          return null
        }
      })
    )

    return NextResponse.json({ outputs: outputs.filter(Boolean) })
  } catch {
    return NextResponse.json({ outputs: [] })
  }
}

export async function POST() {
  const run = (cmd: string) => execSync(cmd, { stdio: 'pipe', cwd: REPO_ROOT, timeout: 15000 }).toString().trim()
  try {
    // Stash any local changes so pull doesn't fail
    const dirty = run('git status --porcelain').length > 0
    if (dirty) run('git stash --include-untracked')
    try {
      run('git pull --rebase origin main')
    } finally {
      if (dirty) run('git stash pop')
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return errorResponse(e, 'Pull failed')
  }
}
