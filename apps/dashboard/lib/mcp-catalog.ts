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
  // When true, one-click install runs the dashboard OAuth flow (POST /api/mcp-auth)
  // instead of wiring a static header: it opens the browser to authorize, captures
  // the tokens into MCP_<slug>_TOKEN + MCP_<slug>_OAUTH, and scripts/mcp-oauth-
  // refresh.sh mints a fresh access token before each headless run. Optionally pin
  // oauthScopes / oauthClientId when the provider needs them (no dynamic client
  // registration). Mutually exclusive with authSecret.
  oauth?: boolean
  oauthScopes?: string[]
  oauthClientId?: string
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    slug: 'base',
    name: 'Base',
    url: 'https://mcp.base.org',
    logo: 'https://pbs.twimg.com/profile_images/2060695832840556549/R0s33fMN_400x400.jpg',
    description: 'Base Account access - wallet, portfolio, swaps, signing, x402 payments, and batched contract calls.',
    // Base is its own OAuth authorization server: no Protected Resource Metadata,
    // but full AS metadata (+ DCR) at https://mcp.base.org/.well-known/oauth-authorization-server.
    // discover() falls back to the MCP origin, so Connect works one-click. We request
    // only the least-privilege transact scope by default; `agent_wallet:escalate` is
    // also offered by the server for elevated actions.
    oauth: true,
    oauthScopes: ['agent_wallet:transact'],
  },
  {
    slug: 'robinhood-trading',
    name: 'Robinhood Trading',
    url: 'https://agent.robinhood.com/mcp/trading',
    logo: 'https://pbs.twimg.com/profile_images/1844399977482813442/1fTlYz2c_400x400.png',
    description: 'Robinhood Agentic Trading - read your portfolio, buying power, positions, and order history, and place trades from your agent. Remote HTTP MCP with OAuth; trades execute in a dedicated Agentic brokerage account you authorize. You are responsible for every order your agent places.',
    oauth: true,
  },
  {
    slug: 'glim',
    name: 'glim.sh',
    url: 'https://glim.sh/mcp',
    logo: 'https://raw.githubusercontent.com/glim-sh/glim-mcp/main/assets/icon-400.png',
    description: 'glim.sh - live data for AI agents: web search, full page extraction, Twitter/X, Reddit, GitHub, Amazon, YouTube transcripts. Pay-per-call with x402 (Base/Solana USDC) or MPP (Tempo), or sign in and draw from a prepaid account balance.',
  },
]

export const MCP_BY_SLUG: Record<string, McpCatalogEntry> =
  Object.fromEntries(MCP_CATALOG.map(e => [e.slug, e]))
