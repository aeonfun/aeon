import { execFileSync } from 'child_process'
import { ghSecretSet } from './gh'

export const GH_GLOBAL_SECRET = 'GH_GLOBAL'

// GH_GLOBAL is the instance's one GitHub token (docs/CONFIGURATION.md "Cross-repo
// access"): classic-style scopes `repo` (cross-repo + private reads/writes,
// advisories, writing Actions secrets back) and `workflow` (pushes that touch
// .github/workflows/). A token without both fails later, deep inside a run, so
// it is refused here instead.
export const GH_GLOBAL_SCOPES = ['repo', 'workflow'] as const

// GitHub CLI OAuth (gho_), classic PAT (ghp_), fine-grained PAT (github_pat_).
// All work as GH_TOKEN in Actions. Reject anything else so we never stash an
// Actions installation token (ghs_) or leftover stdout.
export const GH_TOKEN_RE = /^(gho_|ghp_|github_pat_)[A-Za-z0-9_]+$/

export function parseGhAuthToken(raw: string): string {
  const token = raw.trim().split(/\s+/, 1)[0] ?? ''
  if (!GH_TOKEN_RE.test(token)) {
    throw new Error('Could not read a GitHub token from `gh auth token`. Run `gh auth login`, then Connect again. Or paste a PAT with Set.')
  }
  return token
}

// The scopes in an `X-OAuth-Scopes` response header, from `gh api -i user`
// output (HTTP headers, blank line, body). null when the header is absent: a
// fine-grained PAT or GitHub App token, whose permissions cannot be read back.
export function parseOAuthScopes(raw: string): string[] | null {
  const head = raw.split(/\r?\n\r?\n/, 1)[0] ?? ''
  const line = head.split(/\r?\n/).find((l) => /^x-oauth-scopes:/i.test(l))
  if (line === undefined) return null
  return line.slice(line.indexOf(':') + 1).split(',').map((s) => s.trim()).filter(Boolean)
}

// Which of `required` the granted scopes do not cover. `repo` is the only
// umbrella scope that matters here (it implies its repo:* children, never
// `workflow`), so this is a plain set difference.
export function missingScopes(granted: readonly string[], required: readonly string[] = GH_GLOBAL_SCOPES): string[] {
  return required.filter((s) => !granted.includes(s))
}

// The scopes of the token `gh` is using right now, or null when they cannot be
// read (fine-grained token, or the API call failed).
export function ghTokenScopes(): string[] | null {
  try {
    const raw = execFileSync('gh', ['api', '-i', 'user'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    return parseOAuthScopes(raw)
  } catch {
    return null
  }
}

// A token that is not fit to be GH_GLOBAL: a caller mistake (HTTP 400), not
// a server failure.
export class GhGlobalScopeError extends Error {}

const SET_CLASSIC = 'Set GH_GLOBAL to a classic PAT with repo + workflow (https://github.com/settings/tokens, Tokens (classic))'

// Throw a fix-it error unless `token` (with these readable `scopes`) is fit to
// be GH_GLOBAL. Pure, so the route, the CLI and tests share one rule.
export function assertGhGlobalScopes(token: string, scopes: string[] | null): void {
  if (scopes === null) {
    throw new GhGlobalScopeError(token.startsWith('github_pat_')
      ? `This is a fine-grained token, whose permissions cannot be checked. ${SET_CLASSIC}.`
      : `Could not read this token's scopes. ${SET_CLASSIC}, or run \`gh auth refresh -h github.com -s ${GH_GLOBAL_SCOPES.join(',')}\` and connect again.`)
  }
  const missing = missingScopes(scopes)
  if (missing.length) {
    throw new GhGlobalScopeError(`The gh token is missing the ${missing.join(' + ')} scope${missing.length > 1 ? 's' : ''} GH_GLOBAL needs. ${SET_CLASSIC}, or run \`gh auth refresh -h github.com -s ${GH_GLOBAL_SCOPES.join(',')}\` and connect again.`)
  }
}

// Copy the operator's already-authenticated `gh` session into GH_GLOBAL so
// Actions runs with that token. Shared by POST /api/github-auth,
// `aeon auth --github` and `aeon init`. No extra browser flow: the dashboard
// already required `gh auth login` to start. GitHub revokes a gho_ token after
// a year unused or once more than 10 exist for the same app and scopes, so the
// docs recommend a dedicated classic PAT for long-lived instances. Refuses a
// token without the repo + workflow scopes (GhGlobalScopeError).
export function captureGithubToken(): { ok: true; method: 'oauth'; secret: string } {
  let raw: string
  try {
    raw = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    throw new Error('GitHub CLI not authenticated. Run: gh auth login')
  }
  const token = parseGhAuthToken(raw)
  assertGhGlobalScopes(token, ghTokenScopes())
  ghSecretSet(GH_GLOBAL_SECRET, token)
  return { ok: true, method: 'oauth', secret: GH_GLOBAL_SECRET }
}
