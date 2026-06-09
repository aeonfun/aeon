export interface SkillKeyRef {
  key: string       // env-var name, e.g. "XAI_API_KEY"
  optional: boolean // true when the skill degrades gracefully without it (declared with a trailing `?`)
}

export interface SkillMcpRef {
  slug: string      // MCP server slug from the catalog, e.g. "base"
  optional: boolean // true when the skill works better with it but doesn't require it (trailing `?`)
}

export interface Frontmatter {
  name: string
  description: string
  tags: string[]
  requires: SkillKeyRef[]
  mcp: SkillMcpRef[]
}

// Parse a SKILL.md's leading `--- ... ---` block. When `description:` is absent,
// fall back to the first non-heading line (truncated to 120 chars).
export function parseFrontmatter(content: string): Frontmatter {
  const block = content.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? ''

  const name = unquote(block.match(/name:\s*(.+)/)?.[1] ?? '')

  let description = unquote(block.match(/description:\s*(.+)/)?.[1] ?? '')
  if (!description) {
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (t && !t.startsWith('#') && !t.startsWith('---')) {
        description = t.length > 120 ? t.slice(0, 117) + '...' : t
        break
      }
    }
  }

  const tags = parseList(block.match(/tags:\s*\[([^\]]*)\]/)?.[1])

  // `requires:` declares the third-party credentials a skill needs to function.
  // Format mirrors `tags:` — an inline list of env-var names. A trailing `?`
  // marks a key as optional (the skill still runs without it, just degraded /
  // rate-limited). Names reference the central credential registry surfaced in
  // the dashboard's Settings → Access Keys vault.
  //   requires: [XAI_API_KEY, COINGECKO_API_KEY?]
  const requires: SkillKeyRef[] = parseList(block.match(/requires:\s*\[([^\]]*)\]/)?.[1])
    .map(raw => {
      const optional = raw.endsWith('?')
      return { key: raw.replace(/\?$/, '').trim(), optional }
    })
    .filter(r => /^[A-Z][A-Z0-9_]+$/.test(r.key))

  // `mcp:` declares the MCP servers a skill needs. Same shape/semantics as
  // `requires:` (trailing `?` = "works better with"), but slugs reference the
  // MCP catalog (lib/mcp-catalog.ts) surfaced on the dashboard's MCP page.
  //   mcp: [base, ctrl?]
  const mcp: SkillMcpRef[] = parseList(block.match(/mcp:\s*\[([^\]]*)\]/)?.[1])
    .map(raw => {
      const optional = raw.endsWith('?')
      return { slug: raw.replace(/\?$/, '').trim().toLowerCase(), optional }
    })
    .filter(r => /^[a-z][a-z0-9-]+$/.test(r.slug))

  return { name, description, tags, requires, mcp }
}

function parseList(inner: string | undefined): string[] {
  return inner ? inner.split(',').map(t => t.trim()).filter(Boolean) : []
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}
