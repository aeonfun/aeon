import { readdir, readFile, stat } from 'fs/promises'
import { resolve, join, sep, normalize } from 'path'

const REPO_ROOT = resolve(process.cwd(), '..')
export const MEMORY_ROOT = join(REPO_ROOT, 'memory')

const TOPICS_DIR = join(MEMORY_ROOT, 'topics')
const LOGS_DIR = join(MEMORY_ROOT, 'logs')
const ISSUES_DIR = join(MEMORY_ROOT, 'issues')

const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISSUE_PATTERN = /^ISS-\d{3,}$/

/**
 * Resolve a user-supplied child path under a trusted base, refusing any result
 * that escapes the base (symlinks, "..", absolute overrides). Returns null
 * when the path is invalid so callers can surface a 400 rather than leak
 * unexpected files.
 */
function safeJoin(base: string, child: string): string | null {
  const joined = normalize(join(base, child))
  const withSep = joined.endsWith(sep) ? joined : joined + sep
  const baseWithSep = base.endsWith(sep) ? base : base + sep
  if (joined !== base && !withSep.startsWith(baseWithSep)) return null
  return joined
}

export async function readMemoryIndex(): Promise<string | null> {
  try {
    return await readFile(join(MEMORY_ROOT, 'MEMORY.md'), 'utf-8')
  } catch {
    return null
  }
}

export interface TopicFile {
  slug: string
  filename: string
  size: number
  updatedAt: string
}

export async function listTopics(): Promise<TopicFile[]> {
  let entries: string[]
  try {
    entries = await readdir(TOPICS_DIR)
  } catch {
    return []
  }
  const topics: TopicFile[] = []
  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    const full = join(TOPICS_DIR, name)
    try {
      const s = await stat(full)
      if (!s.isFile()) continue
      topics.push({
        slug: name.replace(/\.md$/, ''),
        filename: name,
        size: s.size,
        updatedAt: s.mtime.toISOString(),
      })
    } catch { /* skip unreadable */ }
  }
  topics.sort((a, b) => a.slug.localeCompare(b.slug))
  return topics
}

export async function readTopic(slug: string): Promise<{ slug: string; content: string; updatedAt: string } | null> {
  if (!SLUG_PATTERN.test(slug)) return null
  const path = safeJoin(TOPICS_DIR, `${slug}.md`)
  if (!path) return null
  try {
    const [content, s] = await Promise.all([
      readFile(path, 'utf-8'),
      stat(path),
    ])
    return { slug, content, updatedAt: s.mtime.toISOString() }
  } catch {
    return null
  }
}

export interface LogDay {
  date: string
  filename: string
  size: number
  updatedAt: string
}

export async function listLogs(): Promise<LogDay[]> {
  let entries: string[]
  try {
    entries = await readdir(LOGS_DIR)
  } catch {
    return []
  }
  const logs: LogDay[] = []
  for (const name of entries) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
    if (!m) continue
    const full = join(LOGS_DIR, name)
    try {
      const s = await stat(full)
      if (!s.isFile()) continue
      logs.push({
        date: m[1],
        filename: name,
        size: s.size,
        updatedAt: s.mtime.toISOString(),
      })
    } catch { /* skip unreadable */ }
  }
  logs.sort((a, b) => b.date.localeCompare(a.date))
  return logs
}

export async function readLog(date: string): Promise<{ date: string; content: string; updatedAt: string } | null> {
  if (!DATE_PATTERN.test(date)) return null
  const path = safeJoin(LOGS_DIR, `${date}.md`)
  if (!path) return null
  try {
    const [content, s] = await Promise.all([
      readFile(path, 'utf-8'),
      stat(path),
    ])
    return { date, content, updatedAt: s.mtime.toISOString() }
  } catch {
    return null
  }
}

export interface IssueSummary {
  id: string
  filename: string
  updatedAt: string
}

export async function listIssues(): Promise<IssueSummary[]> {
  let entries: string[]
  try {
    entries = await readdir(ISSUES_DIR)
  } catch {
    return []
  }
  const issues: IssueSummary[] = []
  for (const name of entries) {
    const m = name.match(/^(ISS-\d{3,})\.md$/)
    if (!m) continue
    const full = join(ISSUES_DIR, name)
    try {
      const s = await stat(full)
      if (!s.isFile()) continue
      issues.push({
        id: m[1],
        filename: name,
        updatedAt: s.mtime.toISOString(),
      })
    } catch { /* skip unreadable */ }
  }
  issues.sort((a, b) => b.id.localeCompare(a.id))
  return issues
}

export async function readIssue(id: string): Promise<{ id: string; content: string; updatedAt: string } | null> {
  if (!ISSUE_PATTERN.test(id)) return null
  const path = safeJoin(ISSUES_DIR, `${id}.md`)
  if (!path) return null
  try {
    const [content, s] = await Promise.all([
      readFile(path, 'utf-8'),
      stat(path),
    ])
    return { id, content, updatedAt: s.mtime.toISOString() }
  } catch {
    return null
  }
}

export interface SearchHit {
  source: 'memory' | 'topic' | 'log' | 'issue'
  ref: string
  filename: string
  score: number
  matches: number
  snippet: string
  lineNumber: number
}

interface Corpus {
  source: SearchHit['source']
  ref: string
  filename: string
  content: string
}

async function loadCorpus(): Promise<Corpus[]> {
  const corpus: Corpus[] = []

  const memory = await readMemoryIndex()
  if (memory) corpus.push({ source: 'memory', ref: 'MEMORY', filename: 'MEMORY.md', content: memory })

  const topics = await listTopics()
  for (const t of topics) {
    const full = await readTopic(t.slug)
    if (full) corpus.push({ source: 'topic', ref: t.slug, filename: t.filename, content: full.content })
  }

  const logs = await listLogs()
  for (const l of logs) {
    const full = await readLog(l.date)
    if (full) corpus.push({ source: 'log', ref: l.date, filename: l.filename, content: full.content })
  }

  const issues = await listIssues()
  for (const i of issues) {
    const full = await readIssue(i.id)
    if (full) corpus.push({ source: 'issue', ref: i.id, filename: i.filename, content: full.content })
  }

  return corpus
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9$_-]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
}

function buildSnippet(lines: string[], hitLine: number, needle: string): string {
  const start = Math.max(0, hitLine - 1)
  const end = Math.min(lines.length, hitLine + 2)
  const window = lines.slice(start, end).join('\n').trim()
  // Bold-ish marker for the matched substring — callers can render plain text.
  if (!needle) return window.slice(0, 400)
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
  return window.replace(re, m => `**${m}**`).slice(0, 400)
}

export async function searchMemory(
  query: string,
  opts: { limit?: number; sources?: SearchHit['source'][] } = {},
): Promise<SearchHit[]> {
  const terms = tokenize(query)
  if (terms.length === 0) return []

  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100))
  const allow = opts.sources && opts.sources.length > 0 ? new Set(opts.sources) : null

  const corpus = await loadCorpus()
  const hits: SearchHit[] = []

  for (const doc of corpus) {
    if (allow && !allow.has(doc.source)) continue
    const lines = doc.content.split('\n')
    const lower = doc.content.toLowerCase()

    // Document-level frequency per term — used for ranking.
    let totalMatches = 0
    let distinctTerms = 0
    for (const term of terms) {
      const occurrences = lower.split(term).length - 1
      if (occurrences > 0) {
        distinctTerms += 1
        totalMatches += occurrences
      }
    }
    if (totalMatches === 0) continue

    // Pick the best snippet: first line that contains the longest matching term,
    // falling back to any line with any term.
    const termsByLength = [...terms].sort((a, b) => b.length - a.length)
    let hitLine = -1
    let hitTerm = ''
    for (const term of termsByLength) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(term)) {
          hitLine = i
          hitTerm = term
          break
        }
      }
      if (hitLine >= 0) break
    }
    if (hitLine < 0) continue

    const score =
      totalMatches +
      distinctTerms * 2 + // reward documents that match more query terms
      (doc.source === 'memory' ? 5 : 0) // boost the index file slightly

    hits.push({
      source: doc.source,
      ref: doc.ref,
      filename: doc.filename,
      score,
      matches: totalMatches,
      snippet: buildSnippet(lines, hitLine, hitTerm),
      lineNumber: hitLine + 1,
    })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}
