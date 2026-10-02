// Telegram chat id without copy-paste. After the bot token is saved:
//   1. getMe -> the bot's username; mint a nonce and show
//      https://t.me/<username>?start=<nonce>. Tapping it opens the bot and
//      sends "/start <nonce>".
//   2. Poll getUpdates for that message and save its chat id as
//      TELEGRAM_CHAT_ID.
// getUpdates is called WITHOUT an offset: only an offset confirms (deletes)
// updates, so the messages.yml poller still sees everything we read. A bot in
// webhook mode answers getUpdates with 409; the UI then falls back to the
// manual helper.
//
// The nonce lives in the KvStore (in-memory here, Redis in the hosted fork) so
// a check can only complete a link this dashboard started. Network access is
// injected for tests.

import type { KvStore } from './connect-store'

export const LINK_TTL_SECONDS = 900
const nonceKey = (nonce: string) => `telegram:link:${nonce}`
const TOKEN_RE = /^(\d+):[A-Za-z0-9_-]{20,}$/

interface TgUpdate {
  message?: { text?: string; chat?: { id?: number } }
}

// Deep-link start params allow [A-Za-z0-9_-] up to 64 chars.
export function makeNonce(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// The chat that sent "/start <nonce>", newest first. Pure.
export function findStartChat(updates: unknown, nonce: string): number | null {
  if (!Array.isArray(updates) || !nonce) return null
  for (let i = updates.length - 1; i >= 0; i--) {
    const m = (updates[i] as TgUpdate)?.message
    const text = typeof m?.text === 'string' ? m.text.trim() : ''
    if ((text === `/start ${nonce}` || text.startsWith(`/start ${nonce} `)) && typeof m?.chat?.id === 'number') {
      return m.chat.id
    }
  }
  return null
}

type Fetch = typeof fetch
const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`

export function parseBotToken(token: string): string | null {
  return token.trim().match(TOKEN_RE)?.[1] ?? null
}

export async function startLink(store: KvStore, token: string, fetchImpl: Fetch = fetch): Promise<{ username: string; nonce: string; link: string }> {
  const botId = parseBotToken(token)
  if (!botId) throw new Error('That does not look like a bot token (123456789:AA...).')
  const res = await fetchImpl(api(token.trim(), 'getMe'))
  const body = await res.json().catch(() => ({})) as { ok?: boolean; result?: { username?: string }; description?: string }
  if (!body.ok || !body.result?.username) throw new Error(body.description || 'Telegram rejected the bot token.')
  const nonce = makeNonce()
  await store.set(nonceKey(nonce), { botId }, LINK_TTL_SECONDS)
  const username = body.result.username
  return { username, nonce, link: `https://t.me/${username}?start=${nonce}` }
}

export type LinkCheck =
  | { status: 'waiting' }
  | { status: 'found'; chatId: string }
  | { status: 'webhook' }
  | { status: 'expired' }
  // 100+ unread updates and ours is not among them: getUpdates (without an
  // offset) only ever returns the oldest 100, so a newer /start can't be seen.
  | { status: 'backlog' }

// getUpdates returns at most this many updates per call.
export const UPDATES_PAGE = 100

export async function checkLink(store: KvStore, token: string, nonce: string, fetchImpl: Fetch = fetch): Promise<LinkCheck> {
  const pending = await store.get<{ botId: string }>(nonceKey(nonce))
  if (!pending || pending.botId !== parseBotToken(token)) return { status: 'expired' }
  const res = await fetchImpl(api(token.trim(), 'getUpdates'))
  const body = await res.json().catch(() => ({})) as { ok?: boolean; result?: unknown; description?: string }
  if (res.status === 409) {
    // 409 is also "terminated by other getUpdates request" when the
    // messages.yml poller reads at the same moment: transient, keep waiting.
    return /webhook/i.test(body.description ?? '') ? { status: 'webhook' } : { status: 'waiting' }
  }
  if (!body.ok) throw new Error(body.description || `Telegram getUpdates failed (HTTP ${res.status})`)
  const chatId = findStartChat(body.result, nonce)
  if (chatId === null) {
    return Array.isArray(body.result) && body.result.length >= UPDATES_PAGE ? { status: 'backlog' } : { status: 'waiting' }
  }
  await store.del(nonceKey(nonce))
  return { status: 'found', chatId: String(chatId) }
}
