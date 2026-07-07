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
  // Transport for the installed server. Defaults to 'http' (streamable HTTP);
  // set 'sse' for servers that speak MCP over Server-Sent Events.
  transport?: 'http' | 'sse'
  // When set, one-click install wires an `Authorization: Bearer ${<authSecret>}`
  // header referencing this repo secret, and the MCP panel surfaces a paste-token
  // row for it. Omit for public / OAuth / x402 servers (the existing default).
  authSecret?: string
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
    logo: 'https://pbs.twimg.com/profile_images/2070604629688070144/xNwUGHgX_400x400.jpg',
    description: 'RootAI Edge MCP - crypto market intelligence across Hyperliquid, Base & Paradex: funding-arbitrage scans, cross-exchange spreads, and best-execution routing. Discovery and free tools are no-cost; premium tools settle per-call in USDC via x402.',
  },
  {
    slug: 'blueagent',
    name: 'BlueAgent',
    url: 'https://blueagent.dev/api/mcp',
    logo: 'https://pbs.twimg.com/profile_images/2047719472455438336/CFrEyoNZ_400x400.jpg',
    description: 'BlueAgent - the AI founder console for Base builders: idea, build, audit, ship, and raise, from concept to deployment.',
  },
  {
    slug: 'robinhood-trading',
    name: 'Robinhood Trading',
    url: 'https://agent.robinhood.com/mcp/trading',
    logo: 'https://pbs.twimg.com/profile_images/1844399977482813442/1fTlYz2c_400x400.png',
    description: 'Robinhood Agentic Trading - read your portfolio, buying power, positions, and order history, and place trades from your agent. Remote HTTP MCP with OAuth; trades execute in a dedicated Agentic brokerage account you authorize. You are responsible for every order your agent places.',
  },
  {
    slug: 'glim',
    name: 'glim.sh',
    url: 'https://glim.sh/mcp',
    logo: 'https://raw.githubusercontent.com/glim-sh/glim-mcp/main/assets/icon-400.png',
    description: 'glim.sh - live data for AI agents: web search, full page extraction, Twitter/X, Reddit, GitHub, Amazon, YouTube transcripts. Pay-per-call with x402 (Base/Solana USDC) or MPP (Tempo), or sign in and draw from a prepaid account balance.',
  },
  {
    slug: 'litebeam',
    name: 'Litebeam',
    url: 'https://mcp.litebeam.xyz',
    logo: 'https://pbs.twimg.com/profile_images/2065063781042954241/zcTqmW5j_400x400.jpg',
    description: 'Litebeam - one MCP connection to every microservice. An AI-microservice routing layer: discover and call paid services through a single endpoint, settled from your agent\'s wallet (managed Litebeam wallet or BYO via x402), with budget controls and HITL approvals.',
    transport: 'sse',
    authSecret: 'LITEBEAM_API_KEY',
  },
]

export const MCP_BY_SLUG: Record<string, McpCatalogEntry> =
  Object.fromEntries(MCP_CATALOG.map(e => [e.slug, e]))
