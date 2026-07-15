import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import { tokenVar, oauthVar, makePkce, makeState, authorizeUrl } from './mcp-oauth'

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

test('authorizeUrl omits scope when none given', () => {
  const url = authorizeUrl({
    metadata: { authorization_endpoint: 'https://as.example/authorize', token_endpoint: 'https://as.example/token' },
    clientId: 'c', redirectUri: 'http://localhost/cb', challenge: 'x', state: 's', resource: 'https://r',
  })
  assert.equal(new URL(url).searchParams.get('scope'), null)
})
