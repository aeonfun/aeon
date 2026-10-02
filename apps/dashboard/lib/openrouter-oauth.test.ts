import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'

import { createMemoryStore } from './connect-store'
import { buildAuthUrl, callbackUrl, exchangeCode, finishFlow, flowStatus, startFlow, OPENROUTER_KEYS_URL } from './openrouter-oauth'

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// A fake OpenRouter key endpoint that checks the PKCE pair like the real one.
function fakeOpenRouter(challenge: () => string, opts: { status?: number } = {}) {
  const seen: unknown[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), OPENROUTER_KEYS_URL)
    const body = JSON.parse(String(init?.body)) as { code: string; code_verifier: string; code_challenge_method: string }
    seen.push(body)
    const ok = b64url(createHash('sha256').update(body.code_verifier).digest()) === challenge() && body.code_challenge_method === 'S256'
    if (opts.status || !ok) return new Response(JSON.stringify({ error: { message: 'bad code' } }), { status: opts.status ?? 403 })
    return new Response(JSON.stringify({ key: 'sk-or-v1-minted', user_id: 'u' }), { status: 200 })
  }) as typeof fetch
  return { impl, seen }
}

describe('OpenRouter PKCE flow', () => {
  it('builds the authorize URL with S256 and a state-bound localhost callback', () => {
    const cb = callbackUrl('http://127.0.0.1:5555', 'st8')
    assert.equal(cb, 'http://localhost:5555/api/openrouter-auth/callback?state=st8')
    assert.equal(callbackUrl('https://www.aeon.fun/connect', 'x'), 'https://www.aeon.fun/api/openrouter-auth/callback?state=x')
    const u = new URL(buildAuthUrl({ callbackUrl: cb, challenge: 'abc', label: 'Aeon' }))
    assert.equal(u.origin + u.pathname, 'https://openrouter.ai/auth')
    assert.equal(u.searchParams.get('callback_url'), cb)
    assert.equal(u.searchParams.get('code_challenge'), 'abc')
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(u.searchParams.get('key_label'), 'Aeon')
  })

  it('round-trips start -> callback -> key saved, single use', async () => {
    const store = createMemoryStore()
    const { url, state } = await startFlow(store, { origin: 'http://127.0.0.1:5555', harness: 'codex', label: 'Aeon' })
    const challenge = new URL(url).searchParams.get('code_challenge')!
    assert.deepEqual(await flowStatus(store, state), { status: 'pending' })

    const saved: string[] = []
    const { impl } = fakeOpenRouter(() => challenge)
    const deps = { fetchImpl: impl, save: async (key: string, harness: string) => { saved.push(`${harness}:${key}`); return 'OPENROUTER_API_KEY' } }
    const done = await finishFlow(store, { state, code: 'c0de' }, deps)
    assert.deepEqual(done, { status: 'done', secret: 'OPENROUTER_API_KEY' })
    assert.deepEqual(saved, ['codex:sk-or-v1-minted'])
    assert.deepEqual(await flowStatus(store, state), done)

    // The verifier is gone: a replayed callback cannot mint a second key.
    const replay = await finishFlow(store, { state, code: 'c0de' }, deps)
    assert.equal(replay.status, 'error')
    assert.equal(saved.length, 1)
  })

  it('rejects unknown state, provider errors, and expired flows', async () => {
    let now = 1_000_000
    const store = createMemoryStore(() => now)
    const deps = { save: async () => 'OPENROUTER_API_KEY', fetchImpl: fakeOpenRouter(() => '').impl }
    assert.equal((await finishFlow(store, { state: 'nope', code: 'x' }, deps)).status, 'error')

    const a = await startFlow(store, { origin: 'http://localhost:5555', harness: 'claude', label: 'Aeon' })
    const denied = await finishFlow(store, { state: a.state, code: null, error: 'access_denied' }, deps)
    assert.equal(denied.status, 'error')
    assert.match((denied as { error: string }).error, /access_denied/)

    const b = await startFlow(store, { origin: 'http://localhost:5555', harness: 'claude', label: 'Aeon' })
    now += 11 * 60_000
    assert.equal((await finishFlow(store, { state: b.state, code: 'x' }, deps)).status, 'error')
    assert.equal(await flowStatus(store, b.state), null)
  })

  it('surfaces a refused exchange', async () => {
    const { impl } = fakeOpenRouter(() => 'x', { status: 400 })
    await assert.rejects(exchangeCode('c', 'v', impl), /HTTP 400.*bad code/)
  })
})
