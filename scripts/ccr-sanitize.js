// Custom claude-code-router transformer: strip whitespace-only text content
// blocks before the request reaches the upstream provider.
//
// Claude Code (>= 2.1.104) sometimes emits empty text blocks in the system
// prompt or message content. The Anthropic API itself tolerates the shapes CC
// sends directly, but strict Anthropic-validating upstreams behind OpenAI
// bridges (Surplus, Bedrock proxies, …) reject the round-tripped request with
// "text content blocks must contain non-whitespace text".
// See musistudio/claude-code-router#1328.
//
// Registered by scripts/llm-gateway.sh via config.json:
//   "transformers": [{ "path": ".../scripts/ccr-sanitize.js" }]
// and used first in the provider chain. ccr instantiates `new (require(path))()`
// and skips the transformer gracefully if it fails to load.

const isEmptyTextPart = (part) =>
  part && part.type === 'text' && (typeof part.text !== 'string' || part.text.trim() === '')

const hasToolCalls = (msg) => Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0

module.exports = class SanitizeEmptyText {
  name = 'sanitize-empty-text'

  async transformRequestIn(request) {
    if (!request || typeof request !== 'object') return request

    // System prompt: Anthropic shape is a string or an array of text blocks.
    if (typeof request.system === 'string' && request.system.trim() === '') {
      delete request.system
    } else if (Array.isArray(request.system)) {
      request.system = request.system.filter((p) => !isEmptyTextPart(p))
      if (request.system.length === 0) delete request.system
    }

    if (Array.isArray(request.messages)) {
      request.messages = request.messages
        .map((msg) => {
          if (!msg || !Array.isArray(msg.content)) return msg
          const content = msg.content.filter((p) => !isEmptyTextPart(p))
          // OpenAI-shape assistant messages carry tool_calls outside content;
          // null content is valid there, an empty array often is not.
          if (content.length === 0 && hasToolCalls(msg)) return { ...msg, content: null }
          return { ...msg, content }
        })
        .filter((msg) => {
          if (!msg) return false
          if (typeof msg.content === 'string') return msg.content.trim() !== '' || hasToolCalls(msg)
          if (Array.isArray(msg.content)) return msg.content.length > 0 || hasToolCalls(msg)
          return true // null/undefined content (e.g. tool_calls-only) — leave as-is
        })
    }

    return request
  }
}
