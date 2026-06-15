import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import { normLinks, sanitizeModel } from '@/lib/dispatch'
import type { StrategySources } from '@/lib/types'

// Dispatch the strategy-builder skill with a brief. A dedicated route (not the
// generic /api/skills/[name]/run) because the goal is free text and repo/links
// carry URLs - the generic route strips ':'/'/' and most punctuation from var.
// execFileSync uses argv (no shell), so the composed value is passed safely.

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

function normRepo(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let r = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/\.git$/i, '')
  // keep only owner/repo (drop any deeper path)
  const parts = r.split('/')
  if (parts.length >= 2) r = `${parts[0]}/${parts[1]}`
  return REPO_RE.test(r) ? r : ''
}

function normGoal(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // single-line, delimiter-safe, bounded - STRATEGY.md must stay tight anyway.
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s*\|\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim().slice(0, 600)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StrategySources> & { model?: string }

    const goal = normGoal(body.goal)
    const repo = normRepo(body.repo)
    const links = normLinks(body.links)
    const model = sanitizeModel(body.model)

    if (!goal && !repo && links.length === 0) {
      return NextResponse.json({ error: 'Give at least one input (goal, repo, or links).' }, { status: 400 })
    }

    // goal goes LAST so the skill can read it as the remainder (free text may
    // contain '=', though '|' is already neutralised above).
    const parts: string[] = []
    if (repo) parts.push(`repo=${repo}`)
    if (links.length) parts.push(`links=${links.join(',')}`)
    if (goal) parts.push(`goal=${goal}`)
    const composedVar = parts.join(' | ')

    const args = ['workflow', 'run', 'aeon.yml', '-f', 'skill=strategy-builder', '-f', `var=${composedVar}`]
    if (model) args.push('-f', `model=${model}`)

    execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
    return NextResponse.json({ ok: true, brief: { goal: goal || null, repo: repo || null, links } })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to dispatch strategy-builder')
  }
}
