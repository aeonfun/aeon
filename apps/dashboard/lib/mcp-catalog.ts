// Central catalog of known MCP servers — the single source of truth shared by
// the MCP page's one-click "Featured" installs and the per-skill "MCP servers"
// requirement panel. A skill declares the servers it needs via the `mcp:`
// frontmatter field (slugs below); the dashboard joins on slug for name + logo +
// install URL, exactly like API keys join against the credential registry.
export interface McpCatalogEntry {
  slug: string
  name: string
  url: string
  logo: string
  description?: string
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    slug: 'base',
    name: 'Base',
    url: 'https://mcp.base.org',
    logo: 'https://pbs.twimg.com/profile_images/2060695832840556549/R0s33fMN_400x400.jpg',
    description: 'Base Account access — wallet, portfolio, swaps, signing, x402 payments, and batched contract calls.',
  },
  {
    slug: 'ctrl',
    name: 'Ctrl',
    url: 'https://www.ctrl.build/mcp',
    logo: 'https://pbs.twimg.com/profile_images/2039734967681597440/Hh_-fXR8_400x400.jpg',
    description: 'Ctrl MCP server.',
  },
]

export const MCP_BY_SLUG: Record<string, McpCatalogEntry> =
  Object.fromEntries(MCP_CATALOG.map(e => [e.slug, e]))
