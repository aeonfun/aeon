import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'

const BUILTIN_SECRETS = [
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', group: 'Core', description: 'Claude Code OAuth token (set via Authenticate button)', either: 'auth' },
  { name: 'ANTHROPIC_API_KEY', group: 'Core', description: 'Anthropic API key for Claude Code', either: 'auth' },
  { name: 'BANKR_LLM_KEY', group: 'Core', description: 'Bankr Gateway API key (bk_...) — enable at bankr.bot/api' },
  { name: 'TELEGRAM_BOT_TOKEN', group: 'Telegram', description: 'Bot token from @BotFather' },
  { name: 'TELEGRAM_CHAT_ID', group: 'Telegram', description: 'Your chat ID' },
  { name: 'DISCORD_BOT_TOKEN', group: 'Discord', description: 'Discord bot token' },
  { name: 'DISCORD_CHANNEL_ID', group: 'Discord', description: 'Channel ID for messages' },
  { name: 'DISCORD_WEBHOOK_URL', group: 'Discord', description: 'Webhook URL for notifications' },
  { name: 'SLACK_BOT_TOKEN', group: 'Slack', description: 'Slack bot OAuth token' },
  { name: 'SLACK_CHANNEL_ID', group: 'Slack', description: 'Channel ID for messages' },
  { name: 'SLACK_WEBHOOK_URL', group: 'Slack', description: 'Webhook URL for notifications' },
  { name: 'SENDGRID_API_KEY', group: 'Email', description: 'SendGrid API key — create at sendgrid.com/settings/api_keys' },
  { name: 'NOTIFY_EMAIL_TO', group: 'Email', description: 'Recipient email address for skill notifications' },
  { name: 'DEVTO_API_KEY', group: 'Distribution', description: 'Dev.to API key — generate at dev.to/settings/extensions' },
  { name: 'NEYNAR_API_KEY', group: 'Distribution', description: 'Neynar API key — used by farcaster-digest (read) and syndicate-article (cast)' },
  { name: 'NEYNAR_SIGNER_UUID', group: 'Distribution', description: 'Neynar managed signer UUID — required to publish Farcaster casts' },
  { name: 'XAI_API_KEY', group: 'Skill Keys', description: 'xAI/Grok API key (for tweet skills)' },
  { name: 'COINGECKO_API_KEY', group: 'Skill Keys', description: 'CoinGecko API key (for crypto skills)' },
  { name: 'ALCHEMY_API_KEY', group: 'Skill Keys', description: 'Alchemy API key (for on-chain skills)' },
  { name: 'GH_GLOBAL', group: 'Skill Keys', description: 'GitHub PAT with cross-repo access' },
]

const BUILTIN_NAMES = new Set(BUILTIN_SECRETS.map(s => s.name))

// Valid env var name pattern
const VALID_SECRET_NAME = /^[A-Z][A-Z0-9_]{1,}$/

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function listSecrets(): string[] {
  try {
    const out = execSync('gh secret list --json name -q ".[].name"', {
      stdio: 'pipe',
      cwd: process.cwd(),
    }).toString().trim()
    return out ? out.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

export async function GET() {
  if (!ghAvailable()) {
    return NextResponse.json({
      error: 'GitHub CLI not authenticated. Run: gh auth login',
      ghReady: false,
    }, { status: 503 })
  }

  const setSecrets = new Set(listSecrets())

  // Start with builtin secrets
  const secrets = BUILTIN_SECRETS.map(s => ({
    ...s,
    isSet: setSecrets.has(s.name),
  }))

  // Add any GitHub secrets not in builtins as custom "Skill Keys"
  for (const name of setSecrets) {
    if (!BUILTIN_NAMES.has(name)) {
      secrets.push({ name, group: 'Skill Keys', description: 'Custom secret', isSet: true })
    }
  }

  return NextResponse.json({ secrets, ghReady: true })
}

export async function POST(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name, value } = await request.json()

  if (!name || !value) {
    return NextResponse.json({ error: 'name and value required' }, { status: 400 })
  }

  // Allow any valid env var name (builtins + custom)
  if (!VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name — use UPPER_SNAKE_CASE' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'set', name, '-b', value], {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to set secret'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name } = await request.json()

  if (!name || !VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'delete', name], { stdio: 'pipe', cwd: process.cwd() })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete secret'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
