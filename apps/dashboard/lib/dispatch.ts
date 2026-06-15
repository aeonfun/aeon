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
 * Reduce a model identifier to the safe charset accepted by `gh workflow run`
 * (alphanumerics, underscore, hyphen). Non-string input yields an empty string.
 */
export function sanitizeModel(input: unknown): string {
  return typeof input === 'string' ? input.replace(/[^a-zA-Z0-9_-]/g, '') : ''
}
