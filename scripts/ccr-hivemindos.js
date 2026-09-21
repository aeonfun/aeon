// Custom claude-code-router transformer for credit-billed OpenAI endpoints.
//
// Four things stand between Claude Code and an endpoint that bills per call, and
// all four are fixed here rather than in the endpoint (measured 2026-09-21 against
// the live HivemindOS gateway, then on a real GitHub Actions run):
//
// 1. IDEMPOTENCY. A paid request that cannot be safely retried is refused —
//    HivemindOS Models answers 400 "This app version cannot safely retry a paid
//    request" when the Idempotency-Key header is missing. Claude Code never
//    sends one and ccr's provider config has no slot for a per-request header,
//    but transformRequestIn may return { body, config } and ccr merges
//    config.headers over the provider's own Authorization header.
//
// 2. STREAMING. Claude Code always asks for stream: true. The endpoint accepts
//    that flag and answers application/json anyway — one completion, never SSE —
//    so the request goes upstream non-streamed and the completion is replayed
//    here as the SSE chunks ccr's anthropic transformer expects. The whole answer
//    arrives in one frame instead of token by token, which costs nothing in an
//    unattended run.
//
// 3. REASONING. See transformRequestIn: a disable flag some models refuse.
//
// 4. THE HOLD. A credit-billed endpoint reserves against the completion budget a
//    call asks for. Claude Code asks for 32k every time, so each in-flight call
//    froze about 0.32 USD to spend about 0.014.
//
// Registered by scripts/llm-gateway.sh via config.json:
//   "transformers": [{ "path": ".../scripts/ccr-hivemindos.js" }]

const { randomUUID } = require('node:crypto')

const wantsStream = (context) => {
  const body = context && context.req && context.req.body
  return Boolean(body && body.stream)
}

// HIVEMINDOS_REASONING=keep leaves Claude Code's "reasoning off" flag alone, which is
// cheaper on any model that can honour it. Default is drop, which works everywhere.
const KEEP_REASONING_OFF = String(process.env.HIVEMINDOS_REASONING || '').toLowerCase() === 'keep'

// HIVEMINDOS_MAX_TOKENS caps what each call may ask for (0 disables the cap). The default
// is the endpoint's own per-completion ceiling.
const MAX_TOKENS = process.env.HIVEMINDOS_MAX_TOKENS === undefined ? 4096 : Number(process.env.HIVEMINDOS_MAX_TOKENS)

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

/** One OpenAI-shaped completion → the SSE frames a streaming client expects. */
function replayAsStream(completion) {
  const base = {
    id: completion.id || `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: completion.created || Math.floor(Date.now() / 1000),
    model: completion.model || 'unknown',
  }
  const choice = (completion.choices && completion.choices[0]) || {}
  const message = choice.message || {}
  const frames = []
  const push = (delta, finish_reason = null, extra = {}) =>
    frames.push(`data: ${JSON.stringify({ ...base, ...extra, choices: [{ index: 0, delta, finish_reason }] })}\n\n`)

  push({ role: 'assistant', content: '' })
  if (typeof message.content === 'string' && message.content) push({ content: message.content })
  if (Array.isArray(message.tool_calls)) {
    // Tool calls are what the agent actually acts on, so each one is replayed
    // whole: index, id and the complete arguments string in a single delta.
    message.tool_calls.forEach((call, index) => {
      push({
        tool_calls: [{
          index,
          id: call.id || `call_${randomUUID()}`,
          type: 'function',
          function: { name: (call.function && call.function.name) || '', arguments: (call.function && call.function.arguments) || '' },
        }],
      })
    })
  }
  // Usage rides the finish frame AND a trailing usage-only frame: clients read one or the
  // other, and a client that reads neither records a run that cost nothing (aeon's
  // token-usage.csv and cost tracking did exactly that before this line).
  const usage = completion.usage ? { usage: completion.usage } : {}
  push({}, choice.finish_reason || (message.tool_calls ? 'tool_calls' : 'stop'), usage)
  if (completion.usage) {
    frames.push(`data: ${JSON.stringify({ ...base, choices: [], usage: completion.usage })}\n\n`)
  }
  frames.push('data: [DONE]\n\n')
  return frames.join('')
}

module.exports = class HivemindOS {
  name = 'hivemindos'

  async transformRequestIn(request) {
    const body = { ...request, stream: false }
    delete body.stream_options
    // Claude Code runs with extended thinking off, which ccr's anthropic transformer turns
    // into reasoning: { effort: 'high', enabled: false }. A model that reasons by design
    // refuses the whole request over that flag — measured on a real run: "400 Reasoning is
    // mandatory for this endpoint and cannot be disabled" — and ccr raises an upstream
    // error before any transformer sees the response, so there is nothing to recover from
    // here. Dropping the block leaves each model on its own default: none where reasoning
    // is optional, its own where it is not. On a model that honours the flag, reasoning
    // tokens are most of the bill, so HIVEMINDOS_REASONING=keep sends it as asked.
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
    return { body, config: { headers: { 'Idempotency-Key': randomUUID() } } }
  }

  async transformResponseOut(response, context) {
    if (!wantsStream(context)) return response
    const type = response.headers.get('Content-Type') || ''
    if (type.includes('text/event-stream')) return response // already streaming: leave it alone
    if (!response.ok) return response
    const completion = await response.json()
    return new Response(replayAsStream(completion), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }
}
