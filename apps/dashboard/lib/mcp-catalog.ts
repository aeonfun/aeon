// Central catalog of known MCP servers - the single source of truth shared by
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
    description: 'Base Account access - wallet, portfolio, swaps, signing, x402 payments, and batched contract calls.',
  },
  {
    slug: 'ctrl',
    name: 'Ctrl',
    url: 'https://www.ctrl.build/mcp',
    logo: 'https://pbs.twimg.com/profile_images/2039734967681597440/Hh_-fXR8_400x400.jpg',
    description: 'Ctrl MCP server.',
  },
  {
    slug: 'rootai',
    name: 'RootAI',
    url: 'https://mcp.rootedge.ai/pro',
    logo: 'https://pbs.twimg.com/profile_images/2055018961746399233/09lx9ZYV_400x400.jpg',
    description: 'RootAI Edge MCP - crypto market intelligence across Hyperliquid, Base & Paradex: funding-arbitrage scans, cross-exchange spreads, and best-execution routing. Discovery and free tools are no-cost; premium tools settle per-call in USDC via x402.',
  },
  {
    slug: 'blueagent',
    name: 'BlueAgent',
    url: 'https://blueagent.dev/api/mcp',
    logo: 'https://pbs.twimg.com/profile_images/2047719472455438336/CFrEyoNZ_400x400.jpg',
    description: 'BlueAgent - the AI founder console for Base builders: idea, build, audit, ship, and raise, from concept to deployment.',
  },
]

export const MCP_BY_SLUG: Record<string, McpCatalogEntry> =
  Object.fromEntries(MCP_CATALOG.map(e => [e.slug, e]))
