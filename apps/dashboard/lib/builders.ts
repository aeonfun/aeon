import { execFileSync } from 'child_process'
import { REPO_ROOT } from './gh'
import { normLinks, sanitizeModel } from './dispatch'

// Dispatch logic for the strategy-builder and soul-builder skills. Dedicated to
// each (rather than the generic run route) because their briefs carry URLs and a
// free-text goal, which the generic var-sanitizer would mangle. Shared by the
// /api/strategy/build + /api/soul/build routes and `aeon strategy/soul build`.

const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const HANDLE_RE = /^[A-Za-z0-9_]{1,30}$/
const NAME_RE = /^[\p{L}\p{N} .,'’\-&/]{1,80}$/u

function normRepo(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let r = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/\.git$/i, '')
  const parts = r.split('/')
  if (parts.length >= 2) r = `${parts[0]}/${parts[1]}`
  return REPO_RE.test(r) ? r : ''
}

function normGoal(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s*\|\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim().slice(0, 600)
}

function normHandle(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const h = raw.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/\/.*$/, '')
  return HANDLE_RE.test(h) ? h : ''
}

export interface StrategyBrief { goal: string | null; repo: string | null; links: string[] }

export function buildStrategy(
  input: { goal?: unknown; repo?: unknown; links?: unknown; model?: unknown },
  opts: { dispatch?: boolean } = {},
): { args: string[]; brief: StrategyBrief } {
  const goal = normGoal(input.goal)
  const repo = normRepo(input.repo)
  const links = normLinks(input.links)
  const model = sanitizeModel(input.model)

  if (!goal && !repo && links.length === 0) {
    throw new Error('Give at least one input (goal, repo, or links).')
  }

  // goal goes LAST so the skill reads it as the free-text remainder.
  const parts: string[] = []
  if (repo) parts.push(`repo=${repo}`)
  if (links.length) parts.push(`links=${links.join(',')}`)
  if (goal) parts.push(`goal=${goal}`)
  const composedVar = parts.join(' | ')

  const args = ['workflow', 'run', 'aeon.yml', '-f', 'skill=strategy-builder', '-f', `var=${composedVar}`]
  if (model) args.push('-f', `model=${model}`)

  if (opts.dispatch) execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
  return { args, brief: { goal: goal || null, repo: repo || null, links } }
}

export interface SoulBrief { handle: string | null; name: string | null; links: string[] }

export function buildSoul(
  input: { handle?: unknown; name?: unknown; links?: unknown; model?: unknown },
  opts: { dispatch?: boolean } = {},
): { args: string[]; sources: SoulBrief } {
  const handle = normHandle(input.handle)
  const name = typeof input.name === 'string' && NAME_RE.test(input.name.trim()) ? input.name.trim() : ''
  const links = normLinks(input.links)
  const model = sanitizeModel(input.model)

  if (!handle && !name && links.length === 0) {
    throw new Error('Give at least one valid source (handle, name, or links).')
  }

  const parts: string[] = []
  if (handle) parts.push(`x=${handle}`)
  if (name) parts.push(`name=${name}`)
  if (links.length) parts.push(`links=${links.join(',')}`)
  const composedVar = parts.join(' | ')

  const args = ['workflow', 'run', 'aeon.yml', '-f', 'skill=soul-builder', '-f', `var=${composedVar}`]
  if (model) args.push('-f', `model=${model}`)

  if (opts.dispatch) execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
  return { args, sources: { handle: handle || null, name: name || null, links } }
}
