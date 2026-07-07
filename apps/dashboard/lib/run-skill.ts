import { execFileSync } from 'child_process'
import { REPO_ROOT, ensureActionsCanOpenPRs } from './gh'
import { sanitizeModel } from './dispatch'

const SKILL_NAME_RE = /^[a-z][a-z0-9-]*$/

// Dispatch a skill run via `gh workflow run aeon.yml`. Shared by
// POST /api/skills/[name]/run and `aeon skills run`. Validates the skill name,
// sanitizes var/model exactly as the route did, and — for install-skill —
// guarantees the repo's Actions-can-open-PRs setting first (the in-Actions token
// can't flip it itself). Returns the composed gh argv for dry-run/preview.
export function buildSkillRunArgs(name: string, opts: { var?: string; model?: string } = {}): string[] {
  if (!SKILL_NAME_RE.test(name)) throw new Error(`Invalid skill name: ${name}`)
  const skillVar = typeof opts.var === 'string' ? opts.var.replace(/[^a-zA-Z0-9_ .\-/#@]/g, '') : ''
  const model = sanitizeModel(opts.model)

  const args = ['workflow', 'run', 'aeon.yml', '-f', `skill=${name}`]
  if (skillVar) args.push('-f', `var=${skillVar}`)
  if (model) args.push('-f', `model=${model}`)
  return args
}

export function runSkill(name: string, opts: { var?: string; model?: string } = {}): { args: string[] } {
  const args = buildSkillRunArgs(name, opts)
  if (name === 'install-skill') ensureActionsCanOpenPRs()
  execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
  return { args }
}
