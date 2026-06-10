export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-fable-5', label: 'Fable 5' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

// Secret names that authenticate Aeon's model access: Claude's own credentials
// (OAuth token or Anthropic key) plus the gateway-provider keys that route
// Claude through a third party. Setting any one means the agent can run, so the
// top-bar "Auth" call-to-action hides once at least one is present. Mirrors the
// hasApiKey/hasOauth/hasGateway check in app/api/auth/route.ts.
export const AUTH_SECRETS = [
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'BANKR_LLM_KEY',
  'OPENROUTER_API_KEY',
  'USEPOD_TOKEN',
  'VENICE_API_KEY',
  'SURPLUS_API_KEY',
]

export const DAYS = [
  { label: 'All', value: -1 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
]

// Canonical 8 skill categories. Mirrors get_category() in generate-skills-json
// and the `category` field baked into skills.json — the single source of truth.
// Ordered for display (Core first); every skill maps to exactly one key.
export const CATEGORIES: { key: string; label: string; short: string; color: string }[] = [
  { key: 'core',             label: 'Core',               short: 'Core',         color: '#E5484D' },
  { key: 'research',         label: 'Research & Content', short: 'Research',     color: '#8B5CF6' },
  { key: 'dev',              label: 'Dev & Code',         short: 'Dev',          color: '#3B82F6' },
  { key: 'crypto',           label: 'Crypto & Markets',   short: 'Crypto',       color: '#FF6B1A' },
  { key: 'onchain-security', label: 'Onchain Security',   short: 'Onchain',      color: '#EAB308' },
  { key: 'social',           label: 'Social & Writing',   short: 'Social',       color: '#EC4899' },
  { key: 'productivity',     label: 'Productivity',       short: 'Productivity', color: '#06B6D4' },
  { key: 'meta',             label: 'Meta / Agent',       short: 'Meta',         color: '#9CA3AF' },
]

export const CATEGORY_BY_KEY: Record<string, { label: string; color: string }> =
  Object.fromEntries(CATEGORIES.map(c => [c.key, { label: c.label, color: c.color }]))
