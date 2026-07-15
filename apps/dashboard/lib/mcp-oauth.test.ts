import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import { tokenVar, oauthVar, makePkce, makeState, authorizeUrl, discover } from './mcp-oauth'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

test('tokenVar / oauthVar derive uppercased, sanitized secret names from a slug', () => {
  assert.equal(tokenVar('robinhood-trading'), 'MCP_ROBINHOOD_TRADING_TOKEN')
  assert.equal(oauthVar('robinhood-trading'), 'MCP_ROBINHOOD_TRADING_OAUTH')
  assert.equal(tokenVar('glim'), 'MCP_GLIM_TOKEN')
  // Non-alphanumerics collapse to underscores (matches the runtime script's suffix strip).
  assert.equal(tokenVar('a.b c'), 'MCP_A_B_C_TOKEN')
})

test('makePkce produces a base64url verifier and its S256 challenge', () => {
  const { verifier, challenge } = makePkce()
  assert.match(verifier, /^[A-Za-z0-9_-]+$/, 'verifier is base64url')
  assert.ok(verifier.length >= 43 && verifier.length <= 128, 'verifier within RFC 7636 length')
  assert.equal(challenge, b64url(createHash('sha256').update(verifier).digest()), 'challenge = S256(verifier)')
  // Two calls differ (randomness).
  assert.notEqual(makePkce().verifier, makePkce().verifier)
})

test('makeState is random base64url', () => {
  assert.match(makeState(), /^[A-Za-z0-9_-]+$/)
  assert.notEqual(makeState(), makeState())
})

test('authorizeUrl builds a spec-correct authorization request', () => {
  const url = authorizeUrl({
    metadata: { authorization_endpoint: 'https://as.example/authorize', token_endpoint: 'https://as.example/token' },
    clientId: 'client-123',
    redirectUri: 'http://localhost:3000/api/mcp-auth/callback',
    challenge: 'CHAL',
    state: 'STATE',
    resource: 'https://mcp.example',
    scopes: ['a', 'b'],
  })
  const u = new URL(url)
  assert.equal(u.origin + u.pathname, 'https://as.example/authorize')
  assert.equal(u.searchParams.get('response_type'), 'code')
  assert.equal(u.searchParams.get('client_id'), 'client-123')
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3000/api/mcp-auth/callback')
  assert.equal(u.searchParams.get('code_challenge'), 'CHAL')
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('state'), 'STATE')
  assert.equal(u.searchParams.get('resource'), 'https://mcp.example')
  assert.equal(u.searchParams.get('scope'), 'a b')
})

test('discover falls back to origin AS metadata when there is no Protected Resource Metadata (the Base case)', async () => {
  // Base: no /.well-known/oauth-protected-resource, but full AS metadata at the origin.
  const asMeta = {
    issuer: 'https://mcp.base.org',
    authorization_endpoint: 'https://mcp.base.org/authorize',
    token_endpoint: 'https://mcp.base.org/token',
    registration_endpoint: 'https://mcp.base.org/register',
    scopes_supported: ['agent_wallet:transact', 'agent_wallet:escalate'],
  }
  const orig = globalThis.fetch
  globalThis.fetch = (async (u: string | URL) => {
    const url = String(u)
    if (url.includes('oauth-protected-resource')) return { ok: false, status: 404, json: async () => ({}) } as Response
    if (url.includes('oauth-authorization-server')) return { ok: true, json: async () => asMeta } as Response
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch
  try {
    const d = await discover('https://mcp.base.org')
    assert.equal(d.authServer, 'https://mcp.base.org', 'falls back to the MCP origin as the auth server')
    assert.equal(d.resource, 'https://mcp.base.org')
    assert.equal(d.metadata.authorization_endpoint, 'https://mcp.base.org/authorize')
    assert.equal(d.metadata.registration_endpoint, 'https://mcp.base.org/register')
  } finally {
    globalThis.fetch = orig
  }
})

test('discover throws a clear error when a server advertises no OAuth metadata at all', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = (async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)) as typeof fetch
  try {
    await assert.rejects(discover('https://static-bearer.example'), /No OAuth metadata found/)
  } finally {
    globalThis.fetch = orig
  }
})

test('authorizeUrl omits scope when none given', () => {
  const url = authorizeUrl({
    metadata: { authorization_endpoint: 'https://as.example/authorize', token_endpoint: 'https://as.example/token' },
    clientId: 'c', redirectUri: 'http://localhost/cb', challenge: 'x', state: 's', resource: 'https://r',
  })
  assert.equal(new URL(url).searchParams.get('scope'), null)
})
