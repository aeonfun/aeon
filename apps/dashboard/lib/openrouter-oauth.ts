// One-click OpenRouter connect: OpenRouter's OAuth PKCE flow mints a user API
// key and hands it to us, so the operator never copies a key by hand.
//
//   1. start: make a PKCE pair + our own `state`, keep {verifier, harness} in
//      the KvStore for 10 minutes, and send the browser (a popup) to
//      https://openrouter.ai/auth?callback_url=<cb>&code_challenge=<S256>&...
//      The callback URL carries `state`, which binds the redirect to this flow.
//   2. callback: OpenRouter redirects to <cb>&code=...; take() the flow (single
//      use), POST {code, code_verifier, code_challenge_method} to
//      /api/v1/auth/keys, get {key}, and save it as OPENROUTER_API_KEY.
//   3. The popup tells the opener via postMessage; the opener also polls the
//      status by `state`, in case the provider's pages cut the opener link.
//
// Codes expire in 10 minutes and are single use. Store access goes through
// KvStore (in-memory locally, Redis in the hosted fork); saving the key is
// injected so this module stays free of gh and is unit-testable.

import { makePkce, makeState } from './mcp-oauth'
import type { KvStore } from './connect-store'

export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys'
export const FLOW_TTL_SECONDS = 600

export interface OpenRouterFlow { verifier: string; harness: string }
export type FlowStatus = { status: 'pending' } | { status: 'done'; secret: string } | { status: 'error'; error: string }

const flowKey = (state: string) => `openrouter:flow:${state}`
const statusKey = (state: string) => `openrouter:status:${state}`

// The callback is this dashboard's own route. OpenRouter accepts localhost
// callbacks on any port; a loopback IP host is rewritten to `localhost` so the
// redirect is recognized as local (the dashboard listens on 127.0.0.1, which
// localhost reaches).
export function callbackUrl(origin: string, state: string): string {
  const u = new URL('/api/openrouter-auth/callback', origin)
  if (u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname === '0.0.0.0') u.hostname = 'localhost'
  u.searchParams.set('state', state)
  return u.toString()
}

export function buildAuthUrl(opts: { callbackUrl: string; challenge: string; label: string }): string {
  const u = new URL(OPENROUTER_AUTH_URL)
  u.searchParams.set('callback_url', opts.callbackUrl)
  u.searchParams.set('code_challenge', opts.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('key_label', opts.label)
  return u.toString()
}

export async function startFlow(store: KvStore, opts: { origin: string; harness: string; label: string }): Promise<{ url: string; state: string }> {
  const { verifier, challenge } = makePkce()
  const state = makeState()
  await store.set<OpenRouterFlow>(flowKey(state), { verifier, harness: opts.harness }, FLOW_TTL_SECONDS)
  await store.set<FlowStatus>(statusKey(state), { status: 'pending' }, FLOW_TTL_SECONDS)
  return { url: buildAuthUrl({ callbackUrl: callbackUrl(opts.origin, state), challenge, label: opts.label }), state }
}

// Exchange the code for a key. Throws with a readable message on any failure.
export async function exchangeCode(code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(OPENROUTER_KEYS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  })
  const body = await res.json().catch(() => ({})) as { key?: unknown; error?: { message?: string } | string }
  if (!res.ok) {
    const msg = typeof body.error === 'string' ? body.error : body.error?.message
    throw new Error(`OpenRouter refused the code (HTTP ${res.status})${msg ? `: ${msg}` : ''}. Codes expire after 10 minutes; start again.`)
  }
  if (typeof body.key !== 'string' || !body.key.startsWith('sk-or-')) throw new Error('OpenRouter returned no key')
  return body.key
}

// Finish the flow for `state`. `save` stores the key (gh secret set + gateway
// sync locally). Records the outcome for the status poll and returns it.
export async function finishFlow(
  store: KvStore,
  input: { state: string; code: string | null; error?: string | null },
  deps: { save: (key: string, harness: string) => Promise<string>; fetchImpl?: typeof fetch },
): Promise<FlowStatus> {
  const flow = input.state ? await store.take<OpenRouterFlow>(flowKey(input.state)) : null
  if (!flow) return { status: 'error', error: 'This OpenRouter request expired or was already used. Start again from the dashboard.' }
  let result: FlowStatus
  try {
    if (input.error) throw new Error(`OpenRouter: ${input.error}`)
    if (!input.code) throw new Error('OpenRouter returned no code')
    const key = await exchangeCode(input.code, flow.verifier, deps.fetchImpl)
    result = { status: 'done', secret: await deps.save(key, flow.harness) }
  } catch (e) {
    result = { status: 'error', error: e instanceof Error ? e.message : 'OpenRouter connect failed' }
  }
  await store.set<FlowStatus>(statusKey(input.state), result, FLOW_TTL_SECONDS)
  return result
}

export async function flowStatus(store: KvStore, state: string): Promise<FlowStatus | null> {
  return store.get<FlowStatus>(statusKey(state))
}
