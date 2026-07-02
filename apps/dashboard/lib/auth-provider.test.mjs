import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeAuthConfig } from './auth-provider.ts'

test('stores Anthropic-compatible API keys in ANTHROPIC_API_KEY', () => {
  const config = normalizeAuthConfig({
    key: 'deepseek-api-key',
    baseUrl: 'https://api.deepseek.com/anthropic',
  })

  assert.equal(config.secretName, 'ANTHROPIC_API_KEY')
  assert.equal(config.method, 'api-key')
  assert.equal(config.baseUrl, 'https://api.deepseek.com/anthropic')
})

test('routes Bankr gateway keys to BANKR_LLM_KEY and flips gateway to bankr', () => {
  const config = normalizeAuthConfig({ key: 'bk_live_abc123' })

  assert.equal(config.secretName, 'BANKR_LLM_KEY')
  assert.equal(config.method, 'bankr')
  assert.equal(config.gateway, 'bankr')
  assert.equal(config.baseUrl, '')
})

test('rejects Bankr keys with a custom base URL', () => {
  assert.throws(
    () => normalizeAuthConfig({ key: 'bk_live_abc123', baseUrl: 'https://llm.bankr.bot' }),
    /Bankr gateway keys cannot be used with a custom base URL/,
  )
})

test('keeps the direct gateway for non-Bankr keys', () => {
  assert.equal(normalizeAuthConfig({ key: 'sk-ant-api03-xyz' }).gateway, 'direct')
  assert.equal(normalizeAuthConfig({ key: 'sk-ant-oat-abc123' }).gateway, 'direct')
  assert.equal(normalizeAuthConfig({}).gateway, 'direct')
})

test('stores Claude OAuth tokens separately', () => {
  const config = normalizeAuthConfig({ key: 'sk-ant-oat-abc123' })

  assert.equal(config.secretName, 'CLAUDE_CODE_OAUTH_TOKEN')
  assert.equal(config.method, 'oauth')
  assert.equal(config.baseUrl, '')
})

test('rejects Claude OAuth tokens with custom base URLs', () => {
  assert.throws(
    () => normalizeAuthConfig({ key: 'sk-ant-oat-abc123', baseUrl: 'https://api.deepseek.com/anthropic' }),
    /Claude OAuth tokens cannot be used with a custom base URL/,
  )
})

test('keeps empty auth payload on the Claude OAuth setup path', () => {
  const config = normalizeAuthConfig({})

  assert.equal(config.key, '')
  assert.equal(config.secretName, 'CLAUDE_CODE_OAUTH_TOKEN')
  assert.equal(config.method, 'oauth')
})

test('rejects invalid Anthropic-compatible base URLs', () => {
  assert.throws(
    () => normalizeAuthConfig({ key: 'deepseek-api-key', baseUrl: 'file:///tmp/key' }),
    /Base URL must be an HTTPS URL/,
  )
  assert.throws(
    () => normalizeAuthConfig({ key: 'deepseek-api-key', baseUrl: 'http://api.deepseek.com/anthropic' }),
    /Base URL must be an HTTPS URL/,
  )
})

test('routes OpenRouter keys to OPENROUTER_API_KEY by prefix', () => {
  const config = normalizeAuthConfig({ key: 'sk-or-v1-abc123' })

  assert.equal(config.secretName, 'OPENROUTER_API_KEY')
  assert.equal(config.method, 'openrouter')
  assert.equal(config.gateway, 'openrouter')
  assert.equal(config.baseUrl, '')
})

test('routes Surplus keys to SURPLUS_API_KEY by prefix', () => {
  const config = normalizeAuthConfig({ key: 'inf_abc123' })

  assert.equal(config.secretName, 'SURPLUS_API_KEY')
  assert.equal(config.method, 'surplus')
  assert.equal(config.gateway, 'surplus')
  assert.equal(config.baseUrl, '')
})

test('routes Venice keys via explicit provider selection', () => {
  const config = normalizeAuthConfig({ key: 'venice-key-no-prefix', provider: 'venice' })

  assert.equal(config.secretName, 'VENICE_API_KEY')
  assert.equal(config.method, 'venice')
  assert.equal(config.gateway, 'venice')
  assert.equal(config.baseUrl, '')
})

test('routes UsePod tokens via explicit provider selection', () => {
  const config = normalizeAuthConfig({ key: 'usepod-token-no-prefix', provider: 'usepod' })

  assert.equal(config.secretName, 'USEPOD_TOKEN')
  assert.equal(config.method, 'usepod')
  assert.equal(config.gateway, 'usepod')
  assert.equal(config.baseUrl, '')
})

test('routes xAI keys to XAI_API_KEY via the grok gateway by prefix', () => {
  const config = normalizeAuthConfig({ key: 'xai-abc123' })

  assert.equal(config.secretName, 'XAI_API_KEY')
  assert.equal(config.method, 'grok')
  assert.equal(config.gateway, 'grok')
  assert.equal(config.baseUrl, '')
})

test('routes xAI keys via explicit grok provider selection', () => {
  const config = normalizeAuthConfig({ key: 'any-xai-key', provider: 'grok' })

  assert.equal(config.secretName, 'XAI_API_KEY')
  assert.equal(config.gateway, 'grok')
})

test('rejects gateway keys with a custom base URL', () => {
  assert.throws(
    () => normalizeAuthConfig({ key: 'sk-or-v1-abc123', baseUrl: 'https://openrouter.ai/api' }),
    /OpenRouter gateway keys cannot be used with a custom base URL/,
  )
  assert.throws(
    () => normalizeAuthConfig({ key: 'any-key', provider: 'venice', baseUrl: 'https://api.venice.ai' }),
    /Venice gateway keys cannot be used with a custom base URL/,
  )
})

test('rejects unknown gateway providers', () => {
  assert.throws(
    () => normalizeAuthConfig({ key: 'some-key', provider: 'nonsense' }),
    /Unknown gateway provider: nonsense/,
  )
})
