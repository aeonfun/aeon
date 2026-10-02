// What the Connect modal tells the operator to run, per harness. PURE data.
//
// Account logins (codex/kimi/hermes/grok) are captured exactly the way the
// runner restores them: `printf '%s' "$SECRET" | base64 -d | tar xzf - -C "$HOME"`
// (scripts/install-harness.sh, scripts/run-grok.sh). So the one-liner is a
// gzip tar rooted at $HOME holding the same paths the dashboard's own capture
// uses (lib/harness-auth.ts credPaths), base64 encoded. macOS `base64` never
// wraps; GNU needs -w0 for a single line. Missing optional files (kimi's
// config.toml) only make tar warn, so stderr is silenced and the pipe still
// carries the files that exist.

import { CAPTURE_SPECS } from './connect-detect'
import { HARNESS_AUTH } from './harness-auth'

export interface KeyLink { label: string; url: string }

export interface ConnectGuide {
  // The login half of the step 1 command (`codex login`), or null when the
  // harness only takes a pasted key.
  login: string | null
  // What step 2 expects back, in words.
  pasteHint: string
  // Alternative for someone inside their aeon checkout.
  cli?: string
  // Where to get an API key instead.
  keys: KeyLink[]
}

const KEYS = {
  anthropic: { label: 'Anthropic key', url: 'https://console.anthropic.com/settings/keys' },
  openrouter: { label: 'OpenRouter key', url: 'https://openrouter.ai/keys' },
  openai: { label: 'OpenAI key', url: 'https://platform.openai.com/api-keys' },
  xai: { label: 'xAI key', url: 'https://console.x.ai' },
  moonshot: { label: 'Moonshot key', url: 'https://platform.moonshot.ai/console/api-keys' },
  mistral: { label: 'Mistral key', url: 'https://console.mistral.ai/api-keys' },
  cursor: { label: 'Cursor key', url: 'https://cursor.com/dashboard?tab=integrations' },
  vercel: { label: 'AI Gateway key', url: 'https://vercel.com/ai-gateway' },
} satisfies Record<string, KeyLink>

const LOGIN: Record<string, string> = {
  codex: 'codex login',
  kimi: 'kimi login',
  hermes: 'hermes auth add nous --type oauth',
  grok: 'grok login --device-auth',
}

export const GUIDES: Record<string, ConnectGuide> = {
  claude: {
    login: 'claude setup-token',
    pasteHint: 'Paste the sk-ant-oat token it prints, or any Anthropic / gateway key.',
    cli: './aeon auth --oauth',
    keys: [KEYS.anthropic, KEYS.openrouter],
  },
  codex: { login: LOGIN.codex, pasteHint: 'Paste the copied login, or an OpenAI key.', cli: './aeon auth --harness codex', keys: [KEYS.openai, KEYS.openrouter] },
  kimi: { login: LOGIN.kimi, pasteHint: 'Paste the copied login, or a Moonshot key.', cli: './aeon auth --harness kimi', keys: [KEYS.moonshot, KEYS.openrouter] },
  hermes: { login: LOGIN.hermes, pasteHint: 'Paste the copied login, or an OpenRouter key.', cli: './aeon auth --harness hermes', keys: [KEYS.openrouter] },
  grok: { login: LOGIN.grok, pasteHint: 'Paste the copied login, or an xAI key (xai-...).', keys: [KEYS.xai] },
  pi: { login: null, pasteHint: 'Paste an Anthropic, OpenAI, or OpenRouter key.', keys: [KEYS.anthropic, KEYS.openai, KEYS.openrouter] },
  vibe: { login: null, pasteHint: 'Paste a Mistral or OpenRouter key.', keys: [KEYS.mistral, KEYS.openrouter] },
  fx: { login: null, pasteHint: 'Paste a Vercel AI Gateway key.', keys: [KEYS.vercel] },
  cursor: { login: null, pasteHint: 'Paste a Cursor API key.', keys: [KEYS.cursor] },
}

export function guideFor(harness: string): ConnectGuide {
  return GUIDES[harness] ?? GUIDES.claude
}

export type Os = 'mac' | 'linux'

// The full step 1 command for an account login: log in, then capture the
// credential files into the clipboard (mac) or print them (linux). claude's
// setup-token prints the token itself, so it needs no capture.
export function captureCommand(harness: string, os: Os): string | null {
  const g = guideFor(harness)
  if (!g.login) return null
  const spec = CAPTURE_SPECS.find((s) => s.harness === harness)
  if (!spec) return g.login
  const tar = `tar -czf - -C ~ ${spec.paths.join(' ')}${spec.paths.length > 1 ? ' 2>/dev/null' : ''}`
  return os === 'mac'
    ? `${g.login} && ${tar} | base64 | pbcopy`
    : `${g.login} && ${tar} | base64 -w0; echo`
}

// Harnesses whose login the dashboard can drive itself on this machine ("Do it
// for me"): claude's setup-token, grok's device login, and every OAuth harness.
export function canDriveLogin(harness: string): boolean {
  return harness === 'claude' || harness === 'grok' || Boolean(HARNESS_AUTH[harness]?.oauth)
}
