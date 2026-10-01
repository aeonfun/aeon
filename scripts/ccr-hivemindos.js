// Request shaping for credit-billed OpenAI endpoints (the hivemindos gateway arm).
//
// Four things stand between Claude Code and an endpoint that bills per call, and
// all four are fixed here rather than in the endpoint (measured 2026-09-21 against
// the live HivemindOS gateway, then on a real GitHub Actions run):
//
// 1. IDEMPOTENCY. A paid request that cannot be safely retried is refused —
//    HivemindOS Models answers 400 "This app version cannot safely retry a paid
//    request" when the Idempotency-Key header is missing. Claude Code never
//    sends one and ccr's provider config has no slot for a per-request header,
//    so prepareRequest() returns one and the gateway plugin adds it.
//
// 2. STREAMING. Claude Code always asks for stream: true. The endpoint accepts
//    that flag and answers application/json anyway - one completion, never SSE -
//    so the request goes upstream non-streamed. ccr 3.x replays a JSON answer to
//    a streaming client as Anthropic SSE by itself (ccr 2.x needed this file to
//    do it; ci-harness-cli.yml's ccr job checks the replay). The whole answer
//    arrives in one frame instead of token by token, which costs nothing in an
//    unattended run.
//
// 3. REASONING. See prepareRequest: a disable flag some models refuse.
//
// 4. THE HOLD. A credit-billed endpoint reserves against the completion budget a
//    call asks for. Claude Code asks for 32k every time, so each in-flight call
//    froze about 0.32 USD to spend about 0.014.
//
// ccr 3.x dropped custom transformer classes, so this is a plain module now:
// scripts/ccr-aeon-gateway.mjs calls prepareRequest() on the final upstream
// (OpenAI-shaped) request when llm-gateway.sh starts the hivemindos arm.

const { randomUUID } = require('node:crypto')

// HIVEMINDOS_REASONING=keep leaves Claude Code's "reasoning off" flag alone, which is
// cheaper on any model that can honour it. Default is drop, which works everywhere.
const KEEP_REASONING_OFF = String(process.env.HIVEMINDOS_REASONING || '').toLowerCase() === 'keep'

// HIVEMINDOS_MAX_TOKENS caps what each call may ask for (0 disables the cap). The default
// is the endpoint's own per-completion ceiling.
// An UNSET GitHub repo variable arrives as the EMPTY STRING, not undefined — the workflow
// writes `HIVEMINDOS_MAX_TOKENS: ${{ vars.HIVEMINDOS_MAX_TOKENS }}` either way — and Number('')
// is 0, which is this knob's "no cap" value. So the default was silently disabled on every run
// through the workflow, which is the opposite of what it says, and each in-flight call went back
// to holding against Claude Code's full 32k ask. Measured on run 35612650907.
const MAX_TOKENS_ASKED = String(process.env.HIVEMINDOS_MAX_TOKENS ?? '').trim()
const MAX_TOKENS = MAX_TOKENS_ASKED === '' ? 4096 : Number(MAX_TOKENS_ASKED)

// HIVEMINDOS_PROMPT_CACHE=off stops marking the stable prefix as cacheable. On a model whose
// provider caches (measured: anthropic/* through this endpoint reads back 7,002 cached tokens
// on a repeat, 0.0088 USD -> 0.00073 USD), this is most of a long run's bill, because an agent
// resends its whole system prompt every turn. Providers that do not cache accept and ignore
// the marker (measured on deepseek), so it is on by default.
const MARK_CACHEABLE = String(process.env.HIVEMINDOS_PROMPT_CACHE || '').toLowerCase() !== 'off'

// The endpoint refuses a body beyond its ceiling, and an agent's conversation grows every turn
// because each turn resends it. Rather than let a long run die on a 413 having already spent
// real money, the oldest tool output is trimmed until the body fits.
const MAX_BODY_CHARS = Number(process.env.HIVEMINDOS_MAX_BODY_CHARS || 4_000_000)

/** Mark the stable prefix (the system prompt) so a caching provider can read it back. */
function markCacheable(body) {
  const first = Array.isArray(body.messages) ? body.messages.find((message) => message && message.role === 'system') : null
  if (!first) return
  if (typeof first.content === 'string') {
    if (!first.content.trim()) return
    first.content = [{ type: 'text', text: first.content, cache_control: { type: 'ephemeral' } }]
    return
  }
  if (!Array.isArray(first.content) || !first.content.length) return
  const last = first.content[first.content.length - 1]
  if (last && typeof last === 'object' && last.type === 'text' && !last.cache_control) {
    last.cache_control = { type: 'ephemeral' }
  }
}

/** Trim the oldest tool output until the body fits. Returns how many messages were trimmed. */
function trimToFit(body, limit) {
  if (!Array.isArray(body.messages)) return 0
  let trimmed = 0
  for (const message of body.messages) {
    if (JSON.stringify(body).length <= limit) break
    // Never touch the system prompt or the newest turn: the first is the instructions and
    // the second is what the agent is answering right now.
    if (!message || message.role === 'system' || message === body.messages[body.messages.length - 1]) continue
    if (typeof message.content === 'string' && message.content.length > 2_000) {
      message.content = `${message.content.slice(0, 2_000)}\n\n[… ${message.content.length - 2_000} characters trimmed: this conversation reached the endpoint's size limit …]`
      trimmed += 1
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part && part.type === 'text' && typeof part.text === 'string' && part.text.length > 2_000) {
          part.text = `${part.text.slice(0, 2_000)}\n\n[… ${part.text.length - 2_000} characters trimmed …]`
          trimmed += 1
        }
      }
    }
  }
  return trimmed
}

/**
 * prepareRequest(body) -> { body, headers }: the upstream chat-completions body
 * reshaped for a credit-billed endpoint, plus the headers to add to the call.
 */
function prepareRequest(request) {
  const body = { ...request, stream: false }
  delete body.stream_options
  // Claude Code runs with extended thinking off, which the gateway turns into a
  // reasoning: { enabled: false } block. A model that reasons by design refuses
  // the whole request over that flag - measured on a real run: "400 Reasoning is
  // mandatory for this endpoint and cannot be disabled". Dropping the block leaves
  // each model on its own default: none where reasoning is optional, its own where
  // it is not. On a model that honours the flag, reasoning tokens are most of the
  // bill, so HIVEMINDOS_REASONING=keep sends it as asked.
  if (!KEEP_REASONING_OFF && body.reasoning && body.reasoning.enabled === false) delete body.reasoning
  // Claude Code asks for 32k completion tokens on every call. A credit-billed endpoint
  // HOLDS against what is asked and refunds the rest, so an unreachable budget freezes
  // real money per in-flight call (measured: ~0.32 USD held per request, net ~0.014).
  // HivemindOS Models caps a completion at 4096 anyway, so asking for more buys nothing.
  if (MAX_TOKENS > 0 && Number(body.max_tokens) > MAX_TOKENS) body.max_tokens = MAX_TOKENS
  if (MARK_CACHEABLE) {
    body.messages = Array.isArray(body.messages) ? body.messages.map((message) => ({ ...message })) : body.messages
    markCacheable(body)
  }
  if (MAX_BODY_CHARS > 0 && JSON.stringify(body).length > MAX_BODY_CHARS) {
    const trimmed = trimToFit(body, MAX_BODY_CHARS)
    if (trimmed) console.error(`[hivemindos] conversation trimmed (${trimmed} message(s)) to fit the endpoint's size limit`)
  }
  return { body, headers: { 'Idempotency-Key': randomUUID() } }
}

module.exports = { prepareRequest, markCacheable, trimToFit }
