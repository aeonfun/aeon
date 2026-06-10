import type { ReactNode } from 'react'

// Bare domains / URLs embedded in secret descriptions (e.g. "openrouter.ai/keys",
// "Create at console.x.ai") arrive as plain text. linkify() turns each into a
// clickable, new-tab link while leaving the surrounding copy untouched. It only
// matches a host with a real dot-separated TLD plus an optional path, so phrases
// like "on-chain", "(bk_...)" or "X-API-Key" are never linked by accident.
const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi

const LINK_CLS =
  'text-eva-orange/80 hover:text-eva-orange underline decoration-dotted underline-offset-2 transition-colors'

export function linkify(text: string): ReactNode {
  if (!text) return text

  const out: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0

  while ((m = URL_RE.exec(text)) !== null) {
    const raw = m[0]
    // Drop trailing sentence punctuation so "foo.com." links to foo.com and
    // the period stays as plain text.
    const url = raw.replace(/[.,;:)\]]+$/, '')
    const tail = raw.slice(url.length)
    const start = m.index

    if (start > last) out.push(text.slice(last, start))

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    out.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={LINK_CLS}
      >
        {url}
      </a>,
    )
    if (tail) out.push(tail)

    last = start + raw.length
  }

  if (last < text.length) out.push(text.slice(last))
  return out.length === 1 ? out[0] : out
}
