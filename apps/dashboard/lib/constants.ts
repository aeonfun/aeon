import { GATEWAY_SECRET_NAMES } from './gateway-registry'

// First entry is the default: it's the top of the model picker AND the fallback the
// harness-switch snap uses (modelsForHarness(...)[0] in app/page.tsx). Keep it in
// sync with the config default in lib/config.ts and aeon.yml `model:`.
export const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-fable-5', label: 'Fable 5' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

// Models offered when the Grok (`grok`) harness is selected.
// - grok-composer-2.5-fast (grok's default) — fast single-agent, runs cleanly in CI.
// - grok-build — reasoning/multi-agent coding model. It used to Cancel every run in
//   the Actions sandbox (its subagent-spawn tool was denied); run-grok.sh now passes
//   --no-subagents by default, so it runs single-agent in CI. Skills that opt into
//   best_of_n:/verify: get subagents back automatically.
// Use the bare CLI id (grok-build), not the API id (grok-build-0.1).
// Keep this list in sync with the workflow_dispatch `model` choice options in
// .github/workflows/aeon.yml — a mismatch 422s at dispatch time.
export const GROK_MODELS = [
  { id: 'grok-composer-2.5-fast', label: 'Composer 2.5' },
  { id: 'grok-build', label: 'Grok Build' },
]

// Harnesses (agent CLIs). `claude` = Claude Code (default, uses the AI Gateway),
// labelled "Anthropic" in the UI; `grok` = Grok Build (own X-account/API-key
// auth, own model list above), labelled "xAI". The `id`s are the on-disk
// harness values (aeon.yml `harness:`) and never change — only the labels do.
export const HARNESSES = [
  { id: 'claude', label: 'Anthropic' },
  { id: 'grok', label: 'xAI' },
] as const

export function modelsForHarness(harness: string) {
  return harness === 'grok' ? GROK_MODELS : MODELS
}

// Secret names that authenticate the CLAUDE harness (Claude Code): its own
// credentials (OAuth token or Anthropic key) or any gateway-provider key that
// routes Claude through a third party (incl. XAI_API_KEY via the grok gateway).
// A grok X-account OAuth session (GROK_CREDENTIALS) does NOT authenticate Claude
// Code, so it is deliberately excluded here.
export const CLAUDE_AUTH_SECRETS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', ...GATEWAY_SECRET_NAMES]

// Auth secrets that specifically authenticate the GROK harness (X-account OAuth
// session or an xAI key). A Claude token does NOT authenticate grok, and vice
// versa — so the top-bar "Auth" CTA and the run-gate must key off the set for the
// SELECTED harness (see authSecretsForHarness), never the union below.
export const GROK_AUTH_SECRETS = ['GROK_CREDENTIALS', 'XAI_API_KEY']

// The auth-secret set that authenticates the given harness. The client derives
// auth state from /api/secrets by testing membership against this — so the Auth
// CTA reappears when you switch to a harness whose own auth isn't set yet.
export function authSecretsForHarness(harness: string): string[] {
  return harness === 'grok' ? GROK_AUTH_SECRETS : CLAUDE_AUTH_SECRETS
}

// Credentials whose CAPABILITY a harness covers with its own built-in tools — so a
// skill that `requires:` that key is runnable on that harness with the secret unset.
// Grok Build fetches X/Twitter posts with its built-in WebSearch/WebFetch, which is
// enough to run the skills that use XAI_API_KEY for `x_search` without the key — at
// web-search quality, NOT the premium xAI x_search feed. So on the grok harness
// XAI_API_KEY is not required to get output; we drop the dashboard's "needs key" gate
// there (only there — claude skills still declare it). The runtime half lives in
// scripts/run-grok.sh, whose compat `--rules` tell the model to fetch X via WebSearch
// when the key is absent instead of hard-exiting. The key stays fully settable either
// way — it powers the premium xAI x_search on BOTH harnesses and the grok gateway.
export const HARNESS_NATIVE_KEYS: Record<string, string[]> = {
  grok: ['XAI_API_KEY'],
}

// Does `harness` cover `key`'s capability with its own built-in tools (so a skill
// requiring it runs on that harness with no secret set)? Drives the "covered by
// <harness>" state in the dashboard's requirement checks.
export function keyProvidedByHarness(key: string, harness: string): boolean {
  return (HARNESS_NATIVE_KEYS[harness] ?? []).includes(key)
}

export const DAYS = [
  { label: 'All', value: -1 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
]

// The skill vocabulary. A skill's `category` IS its pack — one grouping, no
// separate axis (see docs/skill-packs.md), so PACKS below is this same list.
// Mirrors the `categories` map in bin/generate-skills-json and the `category`
// field baked into skills.json. `lab` (category `other`) is the catch-all and
// isn't author-selectable, so it's absent here.
export const CATEGORIES: { key: string; label: string; short: string; color: string }[] = [
  { key: 'core',             label: 'Core',               short: 'Core',         color: '#E5484D' },
  { key: 'evolution',        label: 'Evolution',          short: 'Evolution',    color: '#A855F7' },
  { key: 'basics',           label: 'Basics',             short: 'Basics',       color: '#30A46C' },
  { key: 'dev',              label: 'Dev & Code',         short: 'Dev',          color: '#3B82F6' },
  { key: 'crypto',           label: 'Crypto & Markets',   short: 'Crypto',       color: '#FF6B1A' },
  { key: 'productivity',     label: 'Productivity',       short: 'Productivity', color: '#06B6D4' },
]

// First-party packs — the organizing unit across the dashboard (sidebar groups,
// HQ cards, Packs view). Because category == pack (one grouping), packs ARE the
// CATEGORIES list above, kept as one source of truth so the two can't drift.
// A skill's pack comes from its `pack` field (joined from packs.json in
// /api/skills); `lab` is the catch-all for uncategorized skills. Order drives the
// dashboard's non-default pack order (Core, Evolution + Basics render first via DEFAULT_VISIBLE_PACKS).
const PACKS = CATEGORIES

export const PACK_BY_KEY: Record<string, { label: string; color: string }> =
  Object.fromEntries(PACKS.map(p => [p.key, { label: p.label, color: p.color }]))

// The fixed set of first-party pack keys. Any pack key NOT in here is a
// community pack (installed from another repo — see generate-packs-json's
// `installed` pack and install-skill's per-source community packs). Community
// packs are always shown; the Core-only visibility lens only governs
// first-party packs.
export const FIRST_PARTY_KEYS = new Set(PACKS.map(p => p.key))

// Packs shown by default on the dashboard and locked always-on (not hideable):
// `core` (Aeon's differentiators — fleet, autonomous action), `evolution` (the
// self-improvement loop), and `basics` (simple, immediately-runnable skills).
// Every other first-party pack is hidden until the operator reveals it. Purely a
// view preference — no effect on what runs.
export const DEFAULT_VISIBLE_PACKS = new Set(['core', 'evolution', 'basics'])

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
  const defaultVisible = firstParty.filter(g => DEFAULT_VISIBLE_PACKS.has(g.key))
  const restFirstParty = firstParty.filter(g => !DEFAULT_VISIBLE_PACKS.has(g.key))
  const community = [...present]
    .filter(k => !FIRST_PARTY_KEYS.has(k))
    .sort()
    .map(k => {
      const named = skills.find(s => (s.pack || 'lab') === k && s.packName)
      const label = named?.packName || k
      return { key: k, label, short: label, color: COMMUNITY_COLOR, community: true }
    })
  return [...defaultVisible, ...community, ...restFirstParty]
}
