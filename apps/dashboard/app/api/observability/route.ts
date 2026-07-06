import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { ghAvailable, ghArgsRepo } from '@/lib/gh'
import { errorResponse } from '@/lib/http'

// Langfuse region → OTLP host. The shim (scripts/langfuse-otel.sh) reads the
// LANGFUSE_HOST repo VARIABLE and defaults to EU cloud when it's unset, so EU is
// the default here too. A self-hosted / non-cloud URL surfaces as `custom` and
// is left untouched unless the operator explicitly picks EU or US.
const LANGFUSE_HOSTS = {
  eu: 'https://cloud.langfuse.com',
  us: 'https://us.cloud.langfuse.com',
} as const
type Region = keyof typeof LANGFUSE_HOSTS

function regionOf(host: string | null): Region | 'custom' {
  if (!host) return 'eu'
  const h = host.replace(/\/+$/, '')
  if (h === LANGFUSE_HOSTS.eu) return 'eu'
  if (h === LANGFUSE_HOSTS.us) return 'us'
  return 'custom'
}

function readVar(name: string): string | null {
  try {
    const out = execFileSync(
      'gh',
      ['variable', 'list', ...ghArgsRepo(), '--json', 'name,value', '-q', `.[] | select(.name=="${name}") | .value`],
      { stdio: 'pipe', cwd: process.cwd() },
    ).toString().trim()
    return out || null
  } catch {
    return null
  }
}

export async function GET() {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated. Run: gh auth login', ghReady: false }, { status: 503 })
  }
  const host = readVar('LANGFUSE_HOST')
  return NextResponse.json({ ghReady: true, host, region: regionOf(host) })
}

export async function POST(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({})) as { region?: string }
  const region: Region | null = body.region === 'us' ? 'us' : body.region === 'eu' ? 'eu' : null
  if (!region) {
    return NextResponse.json({ error: "region must be 'eu' or 'us'" }, { status: 400 })
  }
  const host = LANGFUSE_HOSTS[region]
  try {
    execFileSync('gh', ['variable', 'set', 'LANGFUSE_HOST', ...ghArgsRepo(), '--body', host], {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    return NextResponse.json({ ok: true, host, region })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to set LANGFUSE_HOST')
  }
}
