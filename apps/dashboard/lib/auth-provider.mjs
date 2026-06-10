// Gateway providers route Claude Code at a FIXED (non-custom) base URL, the way
// the Bankr path already does. Each maps the pasted key/token to its own repo
// secret; the workflow then wires ANTHROPIC_BASE_URL (or spins up a
// claude-code-router sidecar) based on whichever secret is set. Routing stays on
// `auto` — the provider is resolved at run time (scripts/llm-gateway.sh), not
// pinned on paste. A custom baseUrl is rejected for all of them — the base URL
// is fixed per provider and set by scripts/llm-gateway.sh.
const GATEWAY_PROVIDERS = {
  bankr: { label: 'Bankr', secretName: 'BANKR_LLM_KEY', prefixes: ['bk_'] },
  openrouter: { label: 'OpenRouter', secretName: 'OPENROUTER_API_KEY', prefixes: ['sk-or-'] },
  surplus: { label: 'Surplus Intelligence', secretName: 'SURPLUS_API_KEY', prefixes: ['inf_'] },
  // Venice and UsePod have no distinctive key/token prefix, so they must be
  // selected explicitly via `body.provider` from the dashboard's provider picker.
  // (UsePod's token is embedded in the base URL by the workflow, not sent as a header.)
  venice: { label: 'Venice', secretName: 'VENICE_API_KEY', prefixes: [] },
  usepod: { label: 'UsePod', secretName: 'USEPOD_TOKEN', prefixes: [] },
}

function detectGateway(key, provider) {
  if (provider) {
    if (!GATEWAY_PROVIDERS[provider]) {
      throw new Error(`Unknown gateway provider: ${provider}`)
    }
    return provider
  }
  for (const [name, def] of Object.entries(GATEWAY_PROVIDERS)) {
    if (def.prefixes.some((p) => key.startsWith(p))) return name
  }
  return ''
}

export function normalizeAuthConfig(body = {}) {
  const key = String(body.key || '').trim()
  const baseUrl = String(body.baseUrl || '').trim()
  const provider = String(body.provider || '').trim().toLowerCase()

  if (!key) {
    return { key: '', baseUrl: normalizeBaseUrl(baseUrl), method: 'oauth', secretName: 'CLAUDE_CODE_OAUTH_TOKEN', gateway: 'direct' }
  }

  // Gateway keys: explicit `provider` wins, else infer from an unambiguous prefix.
  // The workflow sets the base URL itself, so a custom one is rejected here.
  const gw = detectGateway(key, provider)
  if (gw) {
    if (baseUrl) {
      throw new Error(`${GATEWAY_PROVIDERS[gw].label} gateway keys cannot be used with a custom base URL`)
    }
    return { key, baseUrl: '', method: gw, secretName: GATEWAY_PROVIDERS[gw].secretName, gateway: gw }
  }

  const isOauth = key.startsWith('sk-ant-oat')
  if (isOauth && baseUrl) {
    throw new Error('Claude OAuth tokens cannot be used with a custom base URL')
  }

  return {
    key,
    baseUrl: isOauth ? '' : normalizeBaseUrl(baseUrl),
    method: isOauth ? 'oauth' : 'api-key',
    secretName: isOauth ? 'CLAUDE_CODE_OAUTH_TOKEN' : 'ANTHROPIC_API_KEY',
    gateway: 'direct',
  }
}

function normalizeBaseUrl(value) {
  if (!value) return ''

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Base URL must be an http(s) URL')
  }

  if (url.protocol !== 'https:') {
    throw new Error('Base URL must be an HTTPS URL')
  }

  return url.toString().replace(/\/$/, '')
}
