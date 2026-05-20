import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function ghRepo(): string | null {
  try {
    const repo = execSync('gh repo set-default --view', { stdio: 'pipe' }).toString().trim()
    if (repo && !repo.startsWith('no default')) return repo
  } catch {}
  try {
    const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { stdio: 'pipe' }).toString().trim()
    if (repo) return repo
  } catch {}
  return null
}

function ghArgsRepo(): string[] {
  const repo = ghRepo()
  return repo ? ['-R', repo] : []
}

export async function GET() {
  // Check if ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN is set
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ authenticated: false, error: 'gh CLI not authenticated' })
    }
    const out = execFileSync('gh', ['secret', 'list', ...ghArgsRepo(), '--json', 'name', '-q', '.[].name'], {
      stdio: 'pipe',
    }).toString().trim()
    const secrets = out ? out.split('\n').filter(Boolean) : []
    const hasApiKey = secrets.includes('ANTHROPIC_API_KEY')
    const hasOauth = secrets.includes('CLAUDE_CODE_OAUTH_TOKEN')
    return NextResponse.json({ authenticated: hasApiKey || hasOauth, hasApiKey, hasOauth })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}

export async function POST(request: Request) {
  // Accept a manually provided API key or OAuth token
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({})) as { key?: string }

    if (body.key) {
      const key = body.key.trim()
      // OAuth tokens (sk-ant-oat) → CLAUDE_CODE_OAUTH_TOKEN
      // API keys (sk-ant-api) → ANTHROPIC_API_KEY
      const isOauth = key.startsWith('sk-ant-oat')
      const secretName = isOauth ? 'CLAUDE_CODE_OAUTH_TOKEN' : 'ANTHROPIC_API_KEY'
      execFileSync('gh', ['secret', 'set', secretName, ...ghArgsRepo()], {
        input: key,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return NextResponse.json({ ok: true, method: isOauth ? 'oauth' : 'api-key', secret: secretName })
    }

    // No key provided — try claude setup-token and extract the sk-ant-oat token
    const output = execSync('claude setup-token', {
      stdio: 'pipe',
      timeout: 60000,
    }).toString()

    // Find the token line and any continuation (token wraps across lines in terminal output)
    // First, strip all whitespace/newlines after "sk-ant-oat" to reassemble a wrapped token
    const tokenBlock = output.slice(output.indexOf('sk-ant-oat'))
    if (!tokenBlock.startsWith('sk-ant-oat')) {
      return NextResponse.json({
        error: 'Could not extract token. Paste your API key manually instead.',
      }, { status: 400 })
    }
    // Extract only valid token characters from each line, stopping at the first
    // line that contributes nothing. This handles terminal wrapping while
    // rejecting any trailing prose, ANSI escapes, or other non-token bytes that
    // the first line might contain after the token text.
    // Token alphabet: A-Za-z0-9_-
    const tokenChars: string[] = []
    for (const line of tokenBlock.split('\n')) {
      const segment = line.trim().match(/^[A-Za-z0-9_\-]+/)?.[0] ?? ''
      if (!segment) break
      tokenChars.push(segment)
    }
    const token = tokenChars.join('')

    if (!token.startsWith('sk-ant-oat')) {
      return NextResponse.json({
        error: 'Could not extract a valid OAuth token. Paste your API key manually instead.',
      }, { status: 400 })
    }

    execFileSync('gh', ['secret', 'set', 'CLAUDE_CODE_OAUTH_TOKEN', ...ghArgsRepo()], {
      input: token,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return NextResponse.json({ ok: true, method: 'oauth' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to setup auth'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
