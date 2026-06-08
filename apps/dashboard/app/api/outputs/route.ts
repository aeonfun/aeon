import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

const OUTPUTS_DIR = join(process.cwd(), 'outputs')
const REPO_ROOT = resolve(process.cwd(), '..', '..')

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
          const spec = JSON.parse(raw)
          // Parse skill name and timestamp from filename: <skill>-<timestamp>.json
          const base = filename.replace('.json', '')
          const tsMatch = base.match(/^(.+?)-(\d{4}-\d{2}-\d{2}T.+Z)$/)
          return {
            filename,
            skill: tsMatch ? tsMatch[1] : base,
            timestamp: tsMatch ? tsMatch[2] : '',
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
    const msg = e instanceof Error ? e.message : 'Pull failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
