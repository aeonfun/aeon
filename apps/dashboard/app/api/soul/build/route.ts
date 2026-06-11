import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { resolve } from 'path'

const REPO_ROOT = resolve(process.cwd(), '..', '..')

// Dispatch the soul-builder skill with a multi-source brief. A dedicated route
// (rather than the generic /api/skills/[name]/run) because soul sources include
// URLs — the generic route strips ':' and '/' from var for injection safety.
// Here we validate each field ourselves and pass a composed var. execFileSync
// uses argv (no shell), so URL characters are safe; the validation below is to
// keep the brief well-formed, not to defend a shell.

const HANDLE_RE = /^[A-Za-z0-9_]{1,30}$/
const NAME_RE = /^[\p{L}\p{N} .,'’\-&/]{1,80}$/u

function normHandle(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const h = raw.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/\/.*$/, '')
  return HANDLE_RE.test(h) ? h : ''
}

function normLinks(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .filter(s => { try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false } })
    .slice(0, 6)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { handle?: string; name?: string; links?: string; model?: string }

    const handle = normHandle(body.handle)
    const name = typeof body.name === 'string' && NAME_RE.test(body.name.trim()) ? body.name.trim() : ''
    const links = normLinks(body.links)
    const model = typeof body.model === 'string' ? body.model.replace(/[^a-zA-Z0-9_-]/g, '') : ''

    if (!handle && !name && links.length === 0) {
      return NextResponse.json({ error: 'Give at least one valid source (handle, name, or links).' }, { status: 400 })
    }

    // Compose the brief the skill parses: " | "-separated key=value tokens.
    const parts: string[] = []
    if (handle) parts.push(`x=${handle}`)
    if (name) parts.push(`name=${name}`)
    if (links.length) parts.push(`links=${links.join(',')}`)
    const composedVar = parts.join(' | ')

    const args = ['workflow', 'run', 'aeon.yml', '-f', 'skill=soul-builder', '-f', `var=${composedVar}`]
    if (model) args.push('-f', `model=${model}`)

    execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
    return NextResponse.json({ ok: true, sources: { handle: handle || null, name: name || null, links } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to dispatch soul-builder'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
