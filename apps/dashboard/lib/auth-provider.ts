import { GATEWAY_REGISTRY, type GatewaySlug } from './gateway-registry'

// Gateway providers route Claude Code at a FIXED (non-custom) base URL: each maps
// the pasted key/token to its own repo secret, and the workflow then wires
// ANTHROPIC_BASE_URL (or spins up a claude-code-router sidecar) based on whichever
// secret is set. Routing stays on `auto` - the provider is resolved at run time
// (scripts/llm-gateway.sh), not pinned on paste. A custom baseUrl is rejected for
// all of them - the base URL is fixed per provider and set by scripts/llm-gateway.sh.

const str = (v: unknown): string => (v ? String(v) : '')

function detectGateway(key: string, provider: string): GatewaySlug | '' {
  if (provider) {
    if (!(provider in GATEWAY_REGISTRY)) {
      throw new Error(`Unknown gateway provider: ${provider}`)
    }
    return provider as GatewaySlug
  }
  for (const [name, def] of Object.entries(GATEWAY_REGISTRY)) {
    if (def.prefixes.some((p) => key.startsWith(p))) return name as GatewaySlug
  }
  return ''
}

export function normalizeAuthConfig(body: { key?: unknown; baseUrl?: unknown; provider?: unknown } = {}) {
  const key = str(body.key).trim()
  const baseUrl = str(body.baseUrl).trim()
  const provider = str(body.provider).trim().toLowerCase()

  if (!key) {
    return { key: '', baseUrl: normalizeBaseUrl(baseUrl), method: 'oauth', secretName: 'CLAUDE_CODE_OAUTH_TOKEN', gateway: 'direct' }
  }

  // Gateway keys: explicit `provider` wins, else infer from an unambiguous prefix.
  // The workflow sets the base URL itself, so a custom one is rejected here.
  const gw = detectGateway(key, provider)
  if (gw) {
    if (baseUrl) {
      throw new Error(`${GATEWAY_REGISTRY[gw].label} gateway keys cannot be used with a custom base URL`)
    }
    return { key, baseUrl: '', method: gw, secretName: GATEWAY_REGISTRY[gw].secretName, gateway: gw }
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

function normalizeBaseUrl(value: string): string {
  if (!value) return ''

  let url: URL
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
