'use client'

/**
 * SkillSearch — search box + ranked results panel powered by /api/skills/search.
 *
 * Drop-in component (Session 06). Mount anywhere in the dashboard:
 *
 *   import { SkillSearch } from '@/components/SkillSearch'
 *   <SkillSearch onSelect={(slug) => setSelectedSkill(slug)} />
 *
 * Inside the Sealed Sprint the underlying embedding provider is `mock` —
 * results are deterministic but NOT semantically meaningful. Post-seal,
 * regenerate the index with a real provider.
 */

import { useState, useEffect, useRef } from 'react'

interface SearchResult {
  slug: string
  name: string
  description: string
  tags: string[]
  score: number
  invoke_as: string
}

interface SearchResponse {
  query: string
  provider: string
  results: SearchResult[]
}

interface SkillSearchProps {
  /** Called when the operator clicks a result. */
  onSelect?: (slug: string) => void
  /** Initial query. */
  initialQuery?: string
  /** Max results to display (default 5). */
  limit?: number
  /** Tag filter. */
  tag?: 'content' | 'crypto' | 'dev' | 'meta' | 'news' | 'research' | 'social' | ''
  /** Compact mode hides the provider hint. */
  compact?: boolean
  /** Debounce delay in ms (default 250). */
  debounceMs?: number
}

export function SkillSearch({
  onSelect,
  initialQuery = '',
  limit = 5,
  tag = '',
  compact = false,
  debounceMs = 250,
}: SkillSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<string>('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q: query, limit: String(limit) })
        if (tag) params.set('tag', tag)
        const r = await fetch(`/api/skills/search?${params}`)
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: 'request failed' }))
          throw new Error(body.error || `HTTP ${r.status}`)
        }
        const data: SearchResponse = await r.json()
        setResults(data.results)
        setProvider(data.provider)
      } catch (e) {
        setError((e as Error).message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, debounceMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, limit, tag, debounceMs])

  return (
    <div className="skill-search">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Describe what you want to do…"
        aria-label="Search skills"
        className="skill-search-input"
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '0.95rem',
        }}
      />

      {!compact && provider === 'mock' && results.length > 0 && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: '#fff8dc',
            borderLeft: '3px solid #b8860b',
            fontSize: '0.8rem',
            color: '#6b5a00',
          }}
        >
          Provider: <code>mock</code> — deterministic but not semantically meaningful.
          Regenerate the index with <code>./index-skills --provider openai</code> for real similarity.
        </div>
      )}

      {loading && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
          Searching…
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: '#fee',
            borderLeft: '3px solid #c00',
            fontSize: '0.85rem',
            color: '#900',
          }}
        >
          {error}
        </div>
      )}

      {results.length > 0 && (
        <ul
          className="skill-search-results"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0.5rem 0 0 0',
            border: '1px solid #eee',
            borderRadius: '4px',
            background: '#fff',
          }}
        >
          {results.map((r, idx) => (
            <li
              key={r.slug}
              style={{
                padding: '0.6rem 0.75rem',
                borderBottom: idx < results.length - 1 ? '1px solid #f0f0f0' : 'none',
                cursor: onSelect ? 'pointer' : 'default',
              }}
              onClick={() => onSelect?.(r.slug)}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <strong style={{ fontSize: '0.95rem' }}>{r.name}</strong>
                <code style={{ fontSize: '0.75rem', color: '#666' }}>
                  {r.score.toFixed(3)}
                </code>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.15rem' }}>
                {r.description}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  marginTop: '0.25rem',
                  fontFamily: 'monospace',
                }}
              >
                <code>{r.invoke_as}</code>
                {r.tags.length > 0 && (
                  <span style={{ marginLeft: '0.75rem' }}>
                    {r.tags.map(t => (
                      <span
                        key={t}
                        style={{
                          display: 'inline-block',
                          padding: '0 0.4rem',
                          marginRight: '0.25rem',
                          background: '#eef',
                          borderRadius: '3px',
                          fontSize: '0.7rem',
                          color: '#557',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
