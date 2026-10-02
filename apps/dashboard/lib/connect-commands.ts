// What the Connect modal tells the operator to run, per harness. PURE.
//
// The facts (login command, `./aeon auth` command, credential paths, where to
// get a key) come from the generated manifest (lib/manifest.ts). Only the UI
// wording and the OS-specific clipboard wrapper live here.
//
// Account logins (codex/kimi/hermes/grok) are captured exactly the way the
// runner restores them: `printf '%s' "$SECRET" | base64 -d | tar xzf - -C "$HOME"`
// (scripts/install-harness.sh, scripts/run-grok.sh). So the one-liner is a
// gzip tar rooted at $HOME holding the manifest's cred_paths, base64 encoded.
// macOS `base64` never wraps; GNU needs -w0 for a single line. Missing optional
// files (kimi's config.toml) only make tar warn, so stderr is silenced and the
// pipe still carries the files that exist.

import { CAPTURE_SPECS } from './connect-detect'
import { MANIFEST_GATEWAYS, harnessManifest } from './manifest'

export interface KeyLink { label: string; url: string }

export interface ConnectGuide {
  // The login half of the step 1 command (`codex login`), or null when the
  // harness's preferred credential is a pasted key.
  login: string | null
  // What step 2 expects back, in words.
  pasteHint: string
  // Alternative for someone inside their aeon checkout.
  cli?: string
  // Where to get an API key instead.
  keys: KeyLink[]
}

// UI wording only.
const PASTE_HINTS: Record<string, string> = {
  claude: 'Paste the sk-ant-oat token it prints, or any Anthropic / gateway key.',
  grok: 'Paste the copied login, or an xAI key (xai-...).',
}

const short = (label: string) => label.replace(/\s*\(.*\)$/, '')

export function guideFor(harness: string): ConnectGuide {
  const h = harnessManifest(harness) ?? harnessManifest('claude')!
  // Step 1 is the harness's most preferred credential when it is a login.
  const first = h.credentials[0]
  const isLogin = Boolean(first?.login_cmd) && (first.kind === 'oauth_capture' || first.kind === 'oauth_token')
  const keys: KeyLink[] = []
  const addKey = (label: string, url: string) => { if (!keys.some((k) => k.url === url)) keys.push({ label, url }) }
  for (const c of h.credentials) if (c.kind === 'api_key') addKey(short(c.label), c.get_url)
  // claude reaches OpenRouter through the gateway cascade.
  if (h.gateways) {
    const or = MANIFEST_GATEWAYS.find((g) => g.id === 'openrouter')
    if (or) addKey(`${or.label} key`, or.get_url)
  }
  const keyNames = h.credentials.filter((c) => c.kind === 'api_key').map((c) => short(c.label).replace(/ (API )?key$/, ''))
  const pasteHint = PASTE_HINTS[harness]
    ?? (isLogin ? `Paste the copied login, or a key (${keyNames.join(', ')}).` : `Paste a key (${keyNames.join(', ')}).`)
  return {
    login: isLogin ? first.login_cmd! : null,
    pasteHint,
    cli: isLogin && first.aeon_cmd && !first.aeon_cmd.includes('<') ? first.aeon_cmd : undefined,
    keys,
  }
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
// for me"): claude's setup-token and every login capture.
export function canDriveLogin(harness: string): boolean {
  return harness === 'claude' || CAPTURE_SPECS.some((s) => s.harness === harness)
}
