import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { ghAvailable, ghArgsRepo } from '@/lib/gh'
import { syncGatewayProvider } from '@/lib/gateway'
import { errorResponse } from '@/lib/http'
import { GATEWAY_SECRET_NAMES } from '@/lib/gateway-registry'
import type { Secret } from '@/lib/types'

const BUILTIN_SECRETS: Omit<Secret, 'isSet'>[] = [
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', group: 'Core', description: 'How Claude Code signs in - option 1 of 2. Runs Aeon on your Claude Pro/Max subscription (no per-token billing). Easiest: click AUTH above; or run claude setup-token locally and paste the token here.', either: 'auth' },
  { name: 'ANTHROPIC_API_KEY', group: 'Core', description: 'How Claude Code signs in - option 2 of 2. A pay-as-you-go Anthropic API key (sk-ant-...) billed via the Console, or any Anthropic-compatible key for a proxy. Create one at console.anthropic.com.', either: 'auth' },
  { name: 'BANKR_LLM_KEY', group: 'Core', description: 'Bankr Gateway API key (bk_...) - enable at bankr.bot/api-keys' },
  { name: 'OPENROUTER_API_KEY', group: 'Core', description: 'OpenRouter API key (sk-or-...) - routes Claude through openrouter.ai. Create at openrouter.ai/keys' },
  { name: 'USEPOD_TOKEN', group: 'Core', description: "UsePod proxy token - routes Claude through UsePod's gateway (token embedded in the base URL). Get one at usepod.ai" },
  { name: 'VENICE_API_KEY', group: 'Core', description: 'Venice API key - routes Claude through api.venice.ai via a local translator. Create at venice.ai/settings/api' },
  { name: 'SURPLUS_API_KEY', group: 'Core', description: 'Surplus Intelligence API key (inf_...) - routes Claude through surplusintelligence.ai via a local translator' },
  { name: 'TELEGRAM_BOT_TOKEN', group: 'Telegram', description: 'Bot token from @BotFather' },
  { name: 'TELEGRAM_CHAT_ID', group: 'Telegram', description: 'Your chat ID' },
  { name: 'DISCORD_BOT_TOKEN', group: 'Discord', description: 'Discord bot token' },
  { name: 'DISCORD_CHANNEL_ID', group: 'Discord', description: 'Channel ID for messages' },
  { name: 'DISCORD_WEBHOOK_URL', group: 'Discord', description: 'Webhook URL for notifications' },
  { name: 'SLACK_BOT_TOKEN', group: 'Slack', description: 'Slack bot OAuth token' },
  { name: 'SLACK_CHANNEL_ID', group: 'Slack', description: 'Channel ID for messages' },
  { name: 'SLACK_WEBHOOK_URL', group: 'Slack', description: 'Webhook URL for notifications' },
  { name: 'SENDGRID_API_KEY', group: 'Email', description: 'SendGrid API key (SendGrid is a Twilio product) - keys & API reference at www.twilio.com/docs/sendgrid/api-reference' },
  { name: 'NOTIFY_EMAIL_TO', group: 'Email', description: 'Recipient email address for skill notifications' },
  // Skill Keys - third-party API keys individual skills call. Each is opt-in:
  // unset means the skills that need it skip rather than fail. Names below are
  // the exact env vars referenced across skills/ (verified by global scan).
  { name: 'XAI_API_KEY', group: 'Skill Keys', description: 'xAI / Grok API key - tweet & X-analysis skills. Create at console.x.ai' },
  { name: 'COINGECKO_API_KEY', group: 'Skill Keys', description: 'CoinGecko API key - crypto price/market skills. Get one at coingecko.com/en/api' },
  { name: 'ALCHEMY_API_KEY', group: 'Skill Keys', description: 'Alchemy API key - on-chain RPC/data skills. Create at dashboard.alchemy.com' },
  { name: 'ETHERSCAN_API_KEY', group: 'Skill Keys', description: 'Etherscan multichain (V2) API key - on-chain skills (tx-explain, rug-scan, holder-concentration); lifts rate limits. Get one at etherscan.io/apis' },
  { name: 'BASESCAN_KEY', group: 'Skill Keys', description: 'Basescan API key - Base on-chain skills (fund-flow, linked-wallets, investigation-report). Get one at basescan.org/myapikey' },
  { name: 'BANKR_API_KEY', group: 'Skill Keys', description: 'Bankr Wallet API key (X-API-Key) - token distribution & treasury skills (distribute-tokens, vigil, treasury-info). Enable at bankr.bot/api-keys' },
  { name: 'VERCEL_TOKEN', group: 'Skill Keys', description: 'Vercel access token - deploy skills (deploy-prototype, vercel-projects). Create at vercel.com/account/settings/tokens' },
  { name: 'REPLICATE_API_TOKEN', group: 'Skill Keys', description: 'Replicate API token - image/diagram generation (technical-explainer). Get one at replicate.com/account/api-tokens' },
  { name: 'RESEND_API_KEY', group: 'Skill Keys', description: 'Resend API key - emailed digests (priority-brief, retrospective). Create at resend.com' },
  { name: 'LIQUIDPAD_API_KEY', group: 'Skill Keys', description: 'Liquidpad API key - token-launch skill (liquidpad-launch). From www.liquidpad.site' },
  { name: 'ADMANAGE_API_KEY', group: 'Skill Keys', description: 'AdManage API key - ad campaign skills (schedule-ads, create-campaign). From admanage.ai/api-docs' },
  { name: 'SUPERNOTES_API_KEY', group: 'Skill Keys', description: 'Supernotes API key - note-taking skill. Create one under Settings → API at supernotes.app' },
  { name: 'CONGRESS_GOV_API_KEY', group: 'Skill Keys', description: 'Congress.gov API key - regulatory monitoring (reg-monitor). Sign up at api.congress.gov/sign-up' },
  { name: 'DEVTO_API_KEY', group: 'Skill Keys', description: 'Dev.to API key - article syndication. Generate at dev.to/settings/extensions' },
  { name: 'NEYNAR_API_KEY', group: 'Skill Keys', description: 'Neynar API key - Farcaster read/cast (farcaster-digest, syndicate-article). Get one at neynar.com' },
  { name: 'NEYNAR_SIGNER_UUID', group: 'Skill Keys', description: 'Neynar managed signer UUID - required to publish Farcaster casts' },
  { name: 'GH_GLOBAL', group: 'Skill Keys', description: 'GitHub PAT with cross-repo access - cross-repo skills & deploys. Create one at github.com/settings/tokens' },
  { name: 'BASE_RPC_URL', group: 'Skill Keys', description: 'Custom Base RPC endpoint - onchain Base skills (fund-flow, honeypot-check, vigil-revoke). Optional: a public RPC is used by default; set a paid endpoint to lift rate limits. Find a provider at docs.base.org/chain/node-providers' },
  { name: 'BEAMR_GATEWAY_URL', group: 'Skill Keys', description: 'BEAMR inference-gateway URL - the beamr-route skill pays per call over x402 (USDC on Base) and returns the answer + onchain receipt.' },
  { name: 'BEAMR_PAYER_KEY', group: 'Skill Keys', description: 'Payer wallet private key (0x...) for the beamr-route skill - fund a DEDICATED low-balance wallet with USDC on Base; per-call spend is capped by the BEAMR_MAX_PAY_USDC variable.' },
]

const BUILTIN_NAMES = new Set(BUILTIN_SECRETS.map(s => s.name))

// Valid env var name pattern
const VALID_SECRET_NAME = /^[A-Z][A-Z0-9_]{1,}$/

function listSecrets(): string[] {
  try {
    const out = execFileSync('gh', ['secret', 'list', ...ghArgsRepo(), '--json', 'name', '-q', '.[].name'], {
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
  const secrets: Secret[] = BUILTIN_SECRETS.map(s => ({
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

  const { name, value } = await request.json() as { name?: string; value?: string }

  if (!name || !value) {
    return NextResponse.json({ error: 'name and value required' }, { status: 400 })
  }

  // Allow any valid env var name (builtins + custom)
  if (!VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name - use UPPER_SNAKE_CASE' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'set', name, ...ghArgsRepo(), '-b', value], {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    // Keep routing on `auto` so the workflow resolves the provider at run time
    // from whichever keys are set (scripts/llm-gateway.sh) - no per-key pinning.
    if (GATEWAY_SECRET_NAMES.includes(name)) await syncGatewayProvider()
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to set secret')
  }
}

export async function DELETE(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name } = await request.json() as { name?: string }

  if (!name || !VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'delete', name, ...ghArgsRepo()], { stdio: 'pipe', cwd: process.cwd() })
    // Stay on `auto`: dropping a key just makes run-time resolution fall through
    // to the next provider whose secret is still set (or `direct`).
    if (GATEWAY_SECRET_NAMES.includes(name)) await syncGatewayProvider()
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to delete secret')
  }
}
