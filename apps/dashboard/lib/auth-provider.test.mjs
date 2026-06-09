import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeAuthConfig } from './auth-provider.mjs'

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
