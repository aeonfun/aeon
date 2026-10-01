// Shared input normalisers for the skill-dispatch routes (soul-builder,
// strategy-builder, generic skill run). Pure helpers - no I/O, no side effects.

/**
 * Normalise a free-text list of links: split on whitespace/commas, prepend
 * `https://` when no scheme is present, keep only valid http(s) URLs, and cap at
 * the first 6. Non-string input yields an empty list.
 */
export function normLinks(input: unknown): string[] {
  if (typeof input !== 'string') return []
  return input
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .filter(s => { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false } })
    .slice(0, 6)
}

/**
 * Reduce a model identifier to a safe id charset: alphanumerics, underscore,
 * hyphen, dot, slash, and colon. Each one is load-bearing for a real id the
 * workflow's `model` choice input accepts: the dot for versions (`grok-4.5`,
 * stripped it became `grok-45`), the slash for OpenRouter-style vendor ids
 * (`openai/gpt-5.1-codex-mini`, stripped it became `openaigpt-5.1-codex-mini`),
 * and the colon for OpenRouter variant suffixes (`vendor/model:free`). Every
 * mangled id 422s at dispatch time. `@` stays out: no id the workflow accepts
 * carries one.
 *
 * After the strip the result must still look like an id: it starts with an
 * alphanumeric, has no empty path segment (`//`) or `..`, and does not end in
 * `/` or `:`. Anything else yields "", so the dispatch falls back to the
 * config default instead of sending a mangled value. The workflow's own
 * `(config default)` sentinel also yields "" (omitting the input is the same
 * thing). Dispatch uses
 * `execFileSync('gh', [...])` (argv array, no shell), so this is
 * defense-in-depth against odd input, not a shell-injection guard. Non-string
 * input yields "".
 */
const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/

export function sanitizeModel(input: unknown): string {
  if (typeof input !== 'string' || input.trim() === '(config default)') return ''
  const id = input.replace(/[^a-zA-Z0-9_.:/-]/g, '')
  if (!MODEL_ID_RE.test(id) || id.includes('//') || id.includes('..') || /[/:]$/.test(id)) return ''
  return id
}
