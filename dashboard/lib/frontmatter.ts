export interface Frontmatter {
  name: string
  description: string
  tags: string[]
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

  const tagsMatch = block.match(/tags:\s*\[([^\]]*)\]/)
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : []

  return { name, description, tags }
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}
