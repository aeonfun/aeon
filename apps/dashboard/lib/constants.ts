export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
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
