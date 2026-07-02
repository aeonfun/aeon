import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { ghAvailable, ghArgsRepo } from '@/lib/gh'
import { syncGatewayProvider } from '@/lib/gateway'
import { errorResponse } from '@/lib/http'

// Connect the Grok Build (`grok`) harness to your X account for CI.
//
// Two paths:
//  1. key present  → store it as the XAI_API_KEY secret (the simple API-key auth
//     path; also powers the Grok gateway). No browser flow.
//  2. no key       → CAPTURE the local grok OAuth session. The operator first
//     runs `grok login --device-auth` in a terminal (browser SSO via auth.x.ai,
//     gated by SuperGrok / X Premium+); this route then tars ~/.grok, base64s it,
//     and stores it as the GROK_CREDENTIALS secret. scripts/run-grok.sh restores
//     it into ~/.grok before each Actions run.
//
// The device-auth login itself is interactive and cannot be driven headlessly,
// so the dashboard surfaces the command and this route only does the capture.
// NOTE: the exact ~/.grok credential filename is still being confirmed, so we
// archive the whole ~/.grok dir minus obvious bulk (sessions/logs/cache). Narrow
// the archive once `grok inspect` pins the credential file.

const GROK_DIR = '.grok'

export async function POST(request: Request) {
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }

    const body = (await request.json().catch(() => ({}))) as { key?: string }
    const key = typeof body.key === 'string' ? body.key.trim() : ''

    // Path 1 — API key.
    if (key) {
      execFileSync('gh', ['secret', 'set', 'XAI_API_KEY', ...ghArgsRepo()], {
        input: key,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      // XAI_API_KEY is also the Grok gateway's secret — keep routing on `auto`.
      await syncGatewayProvider()
      return NextResponse.json({ ok: true, method: 'api-key', secret: 'XAI_API_KEY' })
    }

    // Path 2 — capture the local OAuth session.
    const home = homedir()
    const grokPath = join(home, GROK_DIR)
    if (!existsSync(grokPath) || readdirSync(grokPath).length === 0) {
      return NextResponse.json({
        error: 'No local grok session found. Run `grok login --device-auth` in a terminal first, then click Connect again.',
      }, { status: 400 })
    }

    // tar.gz the session (relative to $HOME so it restores as ~/.grok), base64 it.
    const archive = execFileSync('tar', [
      'czf', '-',
      '-C', home,
      '--exclude', `${GROK_DIR}/sessions`,
      '--exclude', `${GROK_DIR}/logs`,
      '--exclude', `${GROK_DIR}/cache`,
      GROK_DIR,
    ], { maxBuffer: 16 * 1024 * 1024 })
    const b64 = archive.toString('base64')

    execFileSync('gh', ['secret', 'set', 'GROK_CREDENTIALS', ...ghArgsRepo()], {
      input: b64,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return NextResponse.json({ ok: true, method: 'oauth', secret: 'GROK_CREDENTIALS' })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to connect Grok')
  }
}
