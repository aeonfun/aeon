import { GATEWAY_SECRET_NAMES } from './gateway-registry'

export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-fable-5', label: 'Fable 5' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

// Models offered when the Grok (`grok`) harness is selected. Only
// grok-composer-2.5-fast (grok's default) is exposed: it runs cleanly end-to-end
// in GitHub Actions. grok-build is intentionally NOT offered — it Cancels every
// time in the Actions sandbox (works locally, drops its relay/entitlement path in
// CI), so selecting it would be a footgun. Grok still accepts custom model ids
// via ~/.grok/config.toml for anyone who needs one.
export const GROK_MODELS = [
  { id: 'grok-composer-2.5-fast', label: 'Composer 2.5 Fast' },
]

// Harnesses (agent CLIs). `claude` = Claude Code (default, uses the AI Gateway),
// labelled "Anthropic" in the UI; `grok` = Grok Build (own X-account/API-key
// auth, own model list above), labelled "Grok". The `id`s are the on-disk
// harness values (aeon.yml `harness:`) and never change — only the labels do.
export const HARNESSES = [
  { id: 'claude', label: 'Anthropic' },
  { id: 'grok', label: 'Grok' },
] as const

export function modelsForHarness(harness: string) {
  return harness === 'grok' ? GROK_MODELS : MODELS
}

// Secret names that authenticate Aeon's model access: Claude's own credentials
// (OAuth token or Anthropic key), the gateway-provider keys that route Claude
// through a third party (incl. XAI_API_KEY via the grok gateway), and the grok
// harness's X-account OAuth session (GROK_CREDENTIALS). Setting any one means the
// agent can run, so the top-bar "Auth" call-to-action hides once at least one is
// present. The client derives auth state from /api/secrets by testing membership.
export const AUTH_SECRETS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'GROK_CREDENTIALS', ...GATEWAY_SECRET_NAMES]

// Auth secrets that specifically authenticate the GROK harness (X-account OAuth
// session or an xAI key). A Claude token does NOT authenticate grok, so the Auth
// CTA must key off these when the grok harness is selected.
export const GROK_AUTH_SECRETS = ['GROK_CREDENTIALS', 'XAI_API_KEY']

export const DAYS = [
  { label: 'All', value: -1 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
]

// Canonical 8 skill categories. Mirrors get_category() in generate-skills-json
// and the `category` field baked into skills.json - the single source of truth.
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

// First-party packs - the organizing unit across the dashboard (sidebar groups,
// HQ cards, Packs view). Mirrors packs.json / packs.config.json (key, color).
// A skill's pack comes from its `pack` field (joined from packs.json in
// /api/skills); `lab` is the catch-all for uncategorized skills.
const PACKS: { key: string; label: string; short: string; color: string }[] = [
  { key: 'core',         label: 'Core',                  short: 'Core',         color: '#E5484D' },
  { key: 'fleet',        label: 'Fleet & Replication',   short: 'Fleet',        color: '#30A46C' },
  { key: 'research',     label: 'Research & Content',     short: 'Research',     color: '#8B5CF6' },
  { key: 'dev',          label: 'Dev & Code',             short: 'Dev',          color: '#3B82F6' },
  { key: 'markets',      label: 'Crypto & Markets',       short: 'Markets',      color: '#FF6B1A' },
  { key: 'hound',        label: 'Onchain Security',        short: 'Onchain',    color: '#EAB308' },
  { key: 'social',       label: 'Social & Writing',       short: 'Social',       color: '#EC4899' },
  { key: 'productivity', label: 'Productivity',           short: 'Productivity', color: '#06B6D4' },
  { key: 'agent-ops',    label: 'Agent Ops',              short: 'Ops',          color: '#9CA3AF' },
  { key: 'lab',          label: 'Lab',                    short: 'Lab',          color: '#71717A' },
]

export const PACK_BY_KEY: Record<string, { label: string; color: string }> =
  Object.fromEntries(PACKS.map(p => [p.key, { label: p.label, color: p.color }]))

// The fixed set of first-party pack keys. Any pack key NOT in here is a
// community pack (installed from another repo — see generate-packs-json's
// `installed` pack and install-skill's per-source community packs). Community
// packs are always shown; the Core-only visibility lens only governs
// first-party packs.
export const FIRST_PARTY_KEYS = new Set(PACKS.map(p => p.key))

const COMMUNITY_COLOR = '#A1A1AA'

export interface PackGroup { key: string; label: string; short: string; color: string; community: boolean }

// Build the ordered roster/HQ group list from whatever packs the given skills
// actually belong to — driven by data, not a hardcoded list, so a skill in a
// community pack (`installed`, or a per-source pack like `antfleet-pr-review`)
// renders instead of vanishing. Order: Core, then community packs (the things
// you installed, surfaced up top), then the rest of the first-party packs.
// Community labels come from the skill's joined `packName` (falling back to the
// key). Only packs that actually contain skills appear.
export function packGroups(skills: { pack?: string; packName?: string }[]): PackGroup[] {
  const present = new Set(skills.map(s => s.pack || 'lab'))
  const firstParty = PACKS.filter(p => present.has(p.key))
    .map(p => ({ key: p.key, label: p.label, short: p.short, color: p.color, community: false }))
  const core = firstParty.filter(g => g.key === 'core')
  const restFirstParty = firstParty.filter(g => g.key !== 'core')
  const community = [...present]
    .filter(k => !FIRST_PARTY_KEYS.has(k))
    .sort()
    .map(k => {
      const named = skills.find(s => (s.pack || 'lab') === k && s.packName)
      const label = named?.packName || k
      return { key: k, label, short: label, color: COMMUNITY_COLOR, community: true }
    })
  return [...core, ...community, ...restFirstParty]
}
