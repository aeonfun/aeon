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
 * Reduce a model identifier to a safe charset — alphanumerics, underscore,
 * hyphen, and dot. The dot matters: grok model ids carry a version like
 * `grok-composer-2.5-fast`, and stripping it produced `grok-composer-25-fast`,
 * which the workflow's `model` choice input rejects with HTTP 422. Dispatch uses
 * `execFileSync('gh', [...])` (argv array, no shell), so this is defense-in-depth
 * against odd input, not a shell-injection guard. Non-string input yields "".
 */
export function sanitizeModel(input: unknown): string {
  return typeof input === 'string' ? input.replace(/[^a-zA-Z0-9_.-]/g, '') : ''
}
