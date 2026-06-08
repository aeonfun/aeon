export function normalizeAuthConfig(body = {}) {
  const key = String(body.key || '').trim()
  const baseUrl = String(body.baseUrl || '').trim()

  if (!key) {
    return { key: '', baseUrl: normalizeBaseUrl(baseUrl), method: 'oauth', secretName: 'CLAUDE_CODE_OAUTH_TOKEN' }
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
