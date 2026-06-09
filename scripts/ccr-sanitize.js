// Custom claude-code-router transformer: sanitize + normalize requests before
// they reach an OpenAI-compatible upstream.
//
// Two distinct problems, one pass:
//
// 1. Claude Code (>= 2.1.104) sometimes emits whitespace-only text blocks.
//    Strict Anthropic-validating upstreams reject these with "text content
//    blocks must contain non-whitespace text" (musistudio/claude-code-router#1328).
//
// 2. ccr 2.0.0 serializes messages in a hybrid shape: OpenAI envelope, but
//    content as Anthropic-style part arrays carrying `cache_control`. Naive
//    OpenAI bridges (observed with Surplus) read `content` expecting a string,
//    extract nothing, and forward EMPTY system blocks to their Anthropic
//    upstream — same 400, manufactured downstream of a perfectly clean request.
//    Flattening all-text part arrays to plain strings (and dropping
//    cache_control, which is non-standard OpenAI) gives bridges the shape they
//    actually parse.
//
// Registered by scripts/llm-gateway.sh via config.json:
//   "transformers": [{ "path": ".../scripts/ccr-sanitize.js" }]
// ccr instantiates `new (require(path))()` and skips the transformer
// gracefully if it fails to load.

const isTextPart = (part) => part && part.type === 'text'
const isEmptyTextPart = (part) =>
  isTextPart(part) && (typeof part.text !== 'string' || part.text.trim() === '')

const hasToolCalls = (msg) => Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0

// Drop empty text parts, drop cache_control, and flatten to a plain string
// when everything left is text. Mixed content (tool_use, images, …) stays an
// array, minus the junk.
const normalizeContent = (content) => {
  if (!Array.isArray(content)) return content
  const parts = content
    .filter((p) => !isEmptyTextPart(p))
    .map((p) => {
      if (p && typeof p === 'object' && 'cache_control' in p) {
        const { cache_control, ...rest } = p
        return rest
      }
      return p
    })
  if (parts.length === 0) return []
  if (parts.every(isTextPart)) return parts.map((p) => p.text).join('\n\n')
  return parts
}

module.exports = class SanitizeEmptyText {
  name = 'sanitize-empty-text'

  async transformRequestIn(request) {
    if (!request || typeof request !== 'object') return request

    // System prompt: Anthropic shape is a string or an array of text blocks.
    if (typeof request.system === 'string' && request.system.trim() === '') {
      delete request.system
    } else if (Array.isArray(request.system)) {
      const system = normalizeContent(request.system)
      if (system.length === 0) delete request.system
      else request.system = system
    }

    if (Array.isArray(request.messages)) {
      request.messages = request.messages
        .map((msg) => {
          if (!msg || !Array.isArray(msg.content)) return msg
          const content = normalizeContent(msg.content)
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

    // Anthropic marks tool definitions with cache_control too — non-standard
    // for OpenAI endpoints, so scrub it there as well.
    if (Array.isArray(request.tools)) {
      request.tools = request.tools.map((t) => {
        if (t && typeof t === 'object' && 'cache_control' in t) {
          const { cache_control, ...rest } = t
          return rest
        }
        return t
      })
    }

    return request
  }
}
