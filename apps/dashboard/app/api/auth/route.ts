import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'
import { ghAvailable, ghArgsRepo } from '@/lib/gh'
import { normalizeAuthConfig } from '@/lib/auth-provider.mjs'
import { syncGatewayProvider } from '@/lib/gateway'

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
    const hasGateway = ['BANKR_LLM_KEY', 'OPENROUTER_API_KEY', 'USEPOD_TOKEN', 'VENICE_API_KEY', 'SURPLUS_API_KEY']
      .some((name) => secrets.includes(name))
    let hasBaseUrl = false

    try {
      const vars = execFileSync('gh', ['variable', 'list', ...ghArgsRepo(), '--json', 'name', '-q', '.[].name'], {
        stdio: 'pipe',
      }).toString().trim()
      hasBaseUrl = vars ? vars.split('\n').includes('ANTHROPIC_BASE_URL') : false
    } catch {}

    return NextResponse.json({ authenticated: hasApiKey || hasOauth || hasGateway, hasApiKey, hasOauth, hasBankr, hasGateway, hasBaseUrl })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}

export async function POST(request: Request) {
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({})) as { key?: string, baseUrl?: string, provider?: string }
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
      await syncGatewayProvider('auto')
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

    await syncGatewayProvider('auto')
    return NextResponse.json({ ok: true, method: 'oauth' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to setup auth'
    const status = msg.includes('Base URL') || msg.includes('OAuth tokens') || msg.includes('gateway') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
