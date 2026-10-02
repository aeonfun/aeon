import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { createMemoryStore } from './connect-store'
import { checkLink, findStartChat, makeNonce, parseBotToken, startLink } from './telegram-link'

const TOKEN = ['123456789', 'AAHfakeTokenForTestsOnly_0123456789'].join(':')

describe('telegram nonce matcher', () => {
  it('finds the chat that sent /start <nonce>, newest first', () => {
    const updates = [
      { message: { text: '/start abc', chat: { id: 1 } } },
      { message: { text: 'hello', chat: { id: 2 } } },
      { message: { text: '/start abc', chat: { id: 3 } } },
      { edited_message: { text: '/start abc', chat: { id: 4 } } },
    ]
    assert.equal(findStartChat(updates, 'abc'), 3)
  })

  it('ignores other nonces, prefixes, and malformed input', () => {
    assert.equal(findStartChat([{ message: { text: '/start abcd', chat: { id: 1 } } }], 'abc'), null)
    assert.equal(findStartChat([{ message: { text: '/start', chat: { id: 1 } } }], 'abc'), null)
    assert.equal(findStartChat([{ message: { text: 'abc', chat: { id: 1 } } }], 'abc'), null)
    assert.equal(findStartChat([{ message: { text: '/start abc' } }], 'abc'), null)
    assert.equal(findStartChat(null, 'abc'), null)
    assert.equal(findStartChat([{ message: { text: '/start abc', chat: { id: -100 } } }], ''), null)
  })

  it('makes deep-link safe nonces and parses bot ids', () => {
    const n = makeNonce()
    assert.match(n, /^[A-Za-z0-9]{16}$/)
    assert.notEqual(n, makeNonce())
    assert.equal(parseBotToken(TOKEN), '123456789')
    assert.equal(parseBotToken('nope'), null)
  })
})

describe('telegram link flow', () => {
  const tg = (handlers: Record<string, () => Response>) => {
    const calls: string[] = []
    const impl = (async (url: string | URL | Request) => {
      const method = String(url).split('/').pop()!
      calls.push(method)
      return handlers[method]()
    }) as typeof fetch
    return { impl, calls }
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('links the chat that taps the deep link, polling getUpdates without an offset', async () => {
    const store = createMemoryStore()
    let updates: unknown[] = []
    const { impl, calls } = tg({
      getMe: () => json({ ok: true, result: { username: 'aeon_bot' } }),
      getUpdates: () => json({ ok: true, result: updates }),
    })
    const { link, nonce, username } = await startLink(store, TOKEN, impl)
    assert.equal(username, 'aeon_bot')
    assert.equal(link, `https://t.me/aeon_bot?start=${nonce}`)
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'waiting' })
    updates = [{ message: { text: `/start ${nonce}`, chat: { id: 4242 } } }]
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'found', chatId: '4242' })
    // Every getUpdates call was offset-free, so nothing was consumed.
    assert.ok(calls.every((c) => !c.includes('offset')))
    // The nonce is single use.
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'expired' })
  })

  it('reports webhook mode (409 naming the webhook) and rejects a nonce from another bot', async () => {
    const store = createMemoryStore()
    const { impl } = tg({
      getMe: () => json({ ok: true, result: { username: 'b' } }),
      getUpdates: () => json({ ok: false, description: "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first" }, 409),
    })
    const { nonce } = await startLink(store, TOKEN, impl)
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'webhook' })
    const other = ['987654321', 'AAHanotherFakeToken_0123456789abc'].join(':')
    assert.deepEqual(await checkLink(store, other, nonce, impl), { status: 'expired' })
  })

  it('treats a non-webhook 409 (another poller reading) as transient', async () => {
    const store = createMemoryStore()
    const { impl } = tg({
      getMe: () => json({ ok: true, result: { username: 'b' } }),
      getUpdates: () => json({ ok: false, description: 'Conflict: terminated by other getUpdates request; make sure that only one bot instance is running' }, 409),
    })
    const { nonce } = await startLink(store, TOKEN, impl)
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'waiting' })
  })

  it('reports a backlog when 100+ unread updates hide the /start', async () => {
    const store = createMemoryStore()
    let updates: unknown[] = Array.from({ length: 100 }, (_, i) => ({ message: { text: `old ${i}`, chat: { id: i } } }))
    const { impl } = tg({
      getMe: () => json({ ok: true, result: { username: 'b' } }),
      getUpdates: () => json({ ok: true, result: updates }),
    })
    const { nonce } = await startLink(store, TOKEN, impl)
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'backlog' })
    // A full page that does contain the /start still links.
    updates = [...updates.slice(1), { message: { text: `/start ${nonce}`, chat: { id: 7 } } }]
    assert.deepEqual(await checkLink(store, TOKEN, nonce, impl), { status: 'found', chatId: '7' })
    // 99 unread is not a backlog: keep waiting.
    const { nonce: n2 } = await startLink(store, TOKEN, impl)
    updates = updates.slice(0, 99)
    assert.deepEqual(await checkLink(store, TOKEN, n2, impl), { status: 'waiting' })
  })

  it('surfaces a bad token', async () => {
    const store = createMemoryStore()
    const { impl } = tg({ getMe: () => json({ ok: false, description: 'Unauthorized' }, 401) })
    await assert.rejects(startLink(store, TOKEN, impl), /Unauthorized/)
    await assert.rejects(startLink(store, 'garbage', impl), /bot token/)
  })
})
