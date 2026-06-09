import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'
import { ghAvailable, ghArgsRepo, REPO_ROOT } from '@/lib/gh'
import { normalizeAuthConfig } from '@/lib/auth-provider.mjs'
import { getFileContent, updateFile, isLocal } from '@/lib/github'
import { updateGatewayInConfig } from '@/lib/config'
import type { GatewayProvider } from '@/lib/types'

// Commit a working-tree file and push it to the instance repo. In local mode
// updateFile() only writes the working copy, so without this the GitHub Actions
// workflow — which reads gateway.provider from aeon.yml on the remote default
// branch — would never see the change.
function commitAndPush(file: string, message: string) {
  const git = (args: string[]) =>
    execFileSync('git', ['-C', REPO_ROOT, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  git(['add', file])
  git(['-c', 'user.name=Aeon Dashboard', '-c', 'user.email=dashboard@aeon.local', 'commit', '-m', message])
  git(['push'])
}

// Keep aeon.yml's gateway.provider in sync with the authenticated key:
// a Bankr (bk_) key flips it to `bankr`, anything else back to `direct`.
async function syncGatewayProvider(provider: string) {
  const next: GatewayProvider = provider === 'bankr' ? 'bankr' : 'direct'
  const { content, sha } = await getFileContent('aeon.yml')
  const updated = updateGatewayInConfig(content, next)
  if (updated === content) return

  const message = `chore: set LLM gateway provider to ${next}`
  await updateFile('aeon.yml', updated, sha, message)
  // Remote mode (GITHUB_TOKEN+GITHUB_REPO) already committed via the API;
  // local mode wrote only the working copy, so commit & push it.
  if (isLocal()) commitAndPush('aeon.yml', message)
}

export async function GET() {
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
    const hasBankr = secrets.includes('BANKR_LLM_KEY')
    let hasBaseUrl = false

    try {
      const vars = execFileSync('gh', ['variable', 'list', ...ghArgsRepo(), '--json', 'name', '-q', '.[].name'], {
        stdio: 'pipe',
      }).toString().trim()
      hasBaseUrl = vars ? vars.split('\n').includes('ANTHROPIC_BASE_URL') : false
    } catch {}

    return NextResponse.json({ authenticated: hasApiKey || hasOauth || hasBankr, hasApiKey, hasOauth, hasBankr, hasBaseUrl })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}

export async function POST(request: Request) {
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({})) as { key?: string, baseUrl?: string }
    const config = normalizeAuthConfig(body)

    if (config.baseUrl) {
      execFileSync('gh', ['variable', 'set', 'ANTHROPIC_BASE_URL', ...ghArgsRepo(), '--body', config.baseUrl], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }

    if (config.key) {
      execFileSync('gh', ['secret', 'set', config.secretName, ...ghArgsRepo()], {
        input: config.key,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      await syncGatewayProvider(config.gateway)
      return NextResponse.json({ ok: true, method: config.method, secret: config.secretName, baseUrl: Boolean(config.baseUrl), gateway: config.gateway })
    }

    const output = execSync('claude setup-token', {
      stdio: 'pipe',
      timeout: 60000,
    }).toString()

    const tokenBlock = output.slice(output.indexOf('sk-ant-oat'))
    if (!tokenBlock.startsWith('sk-ant-oat')) {
      return NextResponse.json({
        error: 'Could not extract token. Paste your API key manually instead.',
      }, { status: 400 })
    }

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

    await syncGatewayProvider(config.gateway)
    return NextResponse.json({ ok: true, method: 'oauth' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to setup auth'
    const status = msg.includes('Base URL') || msg.includes('OAuth tokens') || msg.includes('Bankr') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
