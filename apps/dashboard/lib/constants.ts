import { GATEWAY_SECRET_NAMES } from './gateway-registry'
import { HARNESS_AUTH } from './harness-auth'
import type { Harness } from './types'

// First entry is the default: it's the top of the model picker AND the fallback the
// harness-switch snap uses (modelsForHarness(...)[0] in app/page.tsx). Keep it in
// sync with the config default in lib/config.ts and aeon.yml `model:`.
// Just the current three. A repo or per-skill pin that still names an older id
// (claude-sonnet-5, claude-opus-4-8, claude-haiku-4-5-20251001) keeps a visible
// entry via pickerOptions.
export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
]

// Models offered when the Grok (`grok`) harness is selected: the ids the
// X-account (GROK_CREDENTIALS) login exposes to the grok CLI's --model flag.
// `grok models` on grok CLI 1.0.46 (verified 2026-10-01) lists grok-4.7 (its
// default: the flagship reasoning model that powers Grok Build, multi-agent-capable;
// the grok adapter passes --no-subagents in CI), grok-4.6 and grok-4.5. Only
// grok-4.7 and grok-4.6 are offered; grok-4.5 stays a workflow_dispatch choice
// so an existing pin still dispatches and renders via RETIRED_MODEL_LABELS.
// Older api.x.ai ids (grok-composer-2.5-fast, grok-build, grok-build-0.1,
// grok-4.3) are model *strings*, NOT valid CLI --model values on the X-account
// OAuth login: the grok CLI rejects each with "unknown model id" (verified live
// 2026-07-22). They're reachable only via XAI_API_KEY on the gateway path (set
// the GROK_MODEL repo var), so listing any here would be a dead click.
// First entry is the default (modelsForHarness(...)[0] on harness switch). Keep this
// list in sync with the workflow_dispatch `model` choice options in
// .github/workflows/aeon.yml — a mismatch 422s at dispatch time.
export const GROK_MODELS = [
  { id: 'grok-4.7', label: 'Grok 4.7' },
  { id: 'grok-4.6', label: 'Grok 4.6' },
]

// kimi gets its own list: it bakes the selected id into a generic OpenRouter
// provider config (`[providers.openrouter] type=openai`), so it drives ANY
// OpenRouter model, and kimi IS Moonshot, so it runs Moonshot's own Kimi family
// through OpenRouter (the way vibe runs Mistral and pi runs DeepSeek). Only the
// latest two are offered: K2.7-code is the default (code-tuned, same price as
// K2.6) and K3 is the strongest (higher quality, ~2× slower and pricier). Both
// measured working end-to-end 2026-07-23 on a real runner (k3 5/5, k2.7-code 4/5).
// K2.6 and K2.5 are no longer offered but stay workflow_dispatch choices, so an
// existing pin still dispatches and renders via RETIRED_MODEL_LABELS. First
// entry is the default (modelsForHarness('kimi')[0] on harness switch)
// — matched by aeon.yml's DEFAULT_HM. Any id here must also appear in the
// workflow_dispatch `model` choice, or a dashboard dispatch of it 422s.
export const KIMI_MODELS = [
  { id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code' },
  { id: 'moonshotai/kimi-k3', label: 'Kimi K3' },
]

// codex needs its own list. It fails DETERMINISTICALLY on gpt-5-nano (it emits a
// shell tool call with a duplicated `cmd` field, its strict parser rejects it,
// and with no --max-turns it spins to the run guard), so nano is never offered.
// The default (first entry, matched by aeon.yml's DEFAULT_HM) is gpt-6-luna,
// newer and cheaper than the prior default gpt-5.1-codex-mini ($0.10/$0.50 vs
// $0.25/$2 per 1M on OpenRouter). gpt-6.1-sol is the quality option.
// The older ids (gpt-6-sol, gpt-5.1-codex-mini, gpt-5-mini, gpt-5.3-codex, the
// gpt-5.6 family) are no longer offered here but stay workflow_dispatch choices,
// so an existing pin still dispatches and renders via RETIRED_MODEL_LABELS.
export const CODEX_MODELS = [
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna' },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol' },
]

// vibe gets its own list: its generic ProviderConfig drives ANY OpenRouter model,
// not just openai/*, so it defaults to Mistral Medium 3.5 (vibe's native family, run
// here through OpenRouter, still Mistral's newest) and also offers DeepSeek V4.1
// Flash. First entry is the default (modelsForHarness('vibe')[0]) and the runtime
// default is set to match in aeon.yml's DEFAULT_HM. Any id here must also appear in
// the workflow_dispatch `model` choice, or a dashboard dispatch 422s.
export const VIBE_MODELS = [
  { id: 'mistralai/mistral-medium-3-5', label: 'Mistral Medium 3.5' },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
]

// pi gets its own list: it drives any OpenRouter model via litellm routing
// (`openrouter/<slug>`), so it runs the two models DeepSeek's own API serves today:
// V4.1 Flash (default, cheap/fast) and V4 Pro (stronger; there is no V4.1 Pro).
// V4 Flash is no longer offered but stays a workflow_dispatch choice, so an
// existing pin still dispatches and renders via RETIRED_MODEL_LABELS. First entry
// is the default (modelsForHarness('pi')[0]), matched by aeon.yml's DEFAULT_HM.
// Any id here must also appear in the workflow_dispatch `model` choice, or a
// dashboard dispatch 422s.
export const PI_MODELS = [
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
]

// cursor runs Cursor's own model ids (not OpenRouter ids). `auto` is Cursor's
// router (it appears in `cursor-agent --list-models`), so it is the default; the
// old `gpt-5.1` default is not a Cursor CLI id and is no longer offered here (it
// stays a workflow_dispatch choice so existing configs still dispatch).
export const CURSOR_MODELS = [{ id: 'auto', label: 'Auto' }]

// hermes defaults to `default`: the model and provider Hermes restores from
// HERMES_AUTH / its config.yaml (the Nous Portal subscription). resolve-harness.sh
// treats `default` as "no override" and the hermes adapter omits --model for it,
// whereas a concrete id here would be written into aeon.yml on harness switch
// (modelsForHarness(...)[0]) and forwarded as --model, which can move Hermes to
// a different provider and bypass the Portal subscription. The rest are opt-in
// overrides; older overrides (claude-sonnet-4.6, gpt-6-sol, gpt-5.4,
// gemini-2.5-pro) stay workflow_dispatch choices and render via
// RETIRED_MODEL_LABELS. Every id must also appear in aeon.yml's workflow_dispatch
// `model` choice (scripts/tests/test_dashboard_model_choices.sh enforces it).
export const HERMES_MODELS = [
  { id: 'default', label: 'Hermes default' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol' },
]

// Harnesses (agent CLIs). `claude` = Claude Code (default, AI Gateway), labelled
// "Anthropic"; `grok` = Grok Build (own X-account/API-key auth, own models),
// "xAI". codex/pi/vibe/kimi run through harness-adapter's run-harness on a
// single OPENROUTER_API_KEY. `fx` also runs through run-harness but has no
// OpenRouter fallback at all — Vercel AI Gateway key or VERCEL_OIDC_TOKEN only
// (see lib/harness-auth.ts and resolve-harness.sh's fx case). The `id`s are the
// on-disk harness values (aeon.yml `harness:`) and never change — only the
// labels do. `satisfies` (not an annotation) keeps each `id` a literal for the
// select options while making a typo'd or dropped harness a compile error
// against the Harness union in ./types.
export const HARNESSES = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'grok', label: 'Grok' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'fx', label: 'fx' },
  { id: 'pi', label: 'Pi' },
  { id: 'vibe', label: 'Mistral' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'hermes', label: 'Hermes' },
] as const satisfies readonly { id: Harness; label: string }[]

// Labels for ids no longer offered in any picker but still valid dispatch
// choices, so a pinned older model renders by name instead of raw id.
const RETIRED_MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-5': 'Sonnet 5',
  'claude-opus-4-8': 'Opus 4.8',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'openai/gpt-5.1-codex-mini': 'GPT-5.1 Codex Mini',
  'openai/gpt-5-mini': 'GPT-5 Mini',
  'openai/gpt-5.3-codex': 'GPT-5.3 Codex',
  'openai/gpt-5.6-luna': 'GPT-5.6 Luna',
  'openai/gpt-5.6-terra': 'GPT-5.6 Terra',
  'openai/gpt-6-sol': 'GPT-6 Sol',
  'deepseek/deepseek-v4-flash': 'DeepSeek V4 Flash',
  'anthropic/claude-sonnet-4.6': 'Claude Sonnet 4.6',
  'openai/gpt-5.4': 'GPT-5.4',
  'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
  'grok-4.5': 'Grok 4.5',
  'moonshotai/kimi-k2.6': 'Kimi K2.6',
  'moonshotai/kimi-k2.5': 'Kimi K2.5',
}

// fx has no model picker: unlike codex/pi/vibe/kimi's OpenRouter path, fx's
// only real auth mode is native-key (AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN),
// and resolve-harness.sh's native-auth branch deliberately never forwards
// --model in that mode (same as codex/pi/vibe/kimi's own native-auth path) —
// fx always runs on its own default model. So this intentionally falls
// through to the generic MODELS default below: whatever renders there is
// cosmetic only for fx and never actually reaches the run.
// The options a model <select> renders. A controlled <select> whose value is
// not among its options silently shows the first one, so a configured model
// that is not offered (an older pin) is appended, marked as configured.
export function pickerOptions(list: readonly { id: string; label: string }[], current?: string | null) {
  if (!current || list.some(m => m.id === current)) return list
  const known = [MODELS, GROK_MODELS, CODEX_MODELS, VIBE_MODELS, PI_MODELS, KIMI_MODELS, CURSOR_MODELS, HERMES_MODELS]
    .flat()
    .find(m => m.id === current)
  const label = known?.label ?? RETIRED_MODEL_LABELS[current] ?? current
  return [...list, { id: current, label: `${label} (configured)` }]
}

export function modelsForHarness(harness: string) {
  if (harness === 'grok') return GROK_MODELS
  if (harness === 'codex') return CODEX_MODELS
  if (harness === 'vibe') return VIBE_MODELS
  if (harness === 'pi') return PI_MODELS
  if (harness === 'kimi') return KIMI_MODELS
  if (harness === 'cursor') return CURSOR_MODELS
  if (harness === 'hermes') return HERMES_MODELS
  return MODELS
}

// Secret names that authenticate the CLAUDE harness (Claude Code): its own
// credentials (OAuth token or Anthropic key) or any gateway-provider key that
// routes Claude through a third party (incl. XAI_API_KEY via the grok gateway).
// A grok X-account OAuth session (GROK_CREDENTIALS) does NOT authenticate Claude
// Code, so it is deliberately excluded here.
export const CLAUDE_AUTH_SECRETS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', ...GATEWAY_SECRET_NAMES]

// Auth secrets that specifically authenticate the GROK harness (X-account OAuth
// session or an xAI key). A Claude token does NOT authenticate grok, and vice
// versa - so the top-bar "Connect a model" CTA and the run-gate must key off the set for the
// SELECTED harness (see authSecretsForHarness), never the union below.
export const GROK_AUTH_SECRETS = ['GROK_CREDENTIALS', 'XAI_API_KEY']

// The auth-secret set that authenticates the given harness. The client derives
// auth state from /api/secrets by testing membership against this — so the Auth
// CTA reappears when you switch to a harness whose own auth isn't set yet.
// codex/pi/vibe/kimi carry their own native-auth secrets (ChatGPT/Moonshot
// captures, provider keys) with OPENROUTER_API_KEY as the shared fallback — the
// full ordered set lives in the HARNESS_AUTH registry (see lib/harness-auth.ts).
export function authSecretsForHarness(harness: string): string[] {
  if (harness === 'grok') return GROK_AUTH_SECRETS
  const spec = HARNESS_AUTH[harness]
  if (spec) return spec.authSecrets
  return CLAUDE_AUTH_SECRETS
}

// Credentials whose CAPABILITY a harness covers with its own built-in tools — so a
// skill that `requires:` that key is runnable on that harness with the secret unset.
// Grok Build fetches X/Twitter posts with its built-in WebSearch/WebFetch, which is
// enough to run the skills that use XAI_API_KEY for `x_search` without the key — at
// web-search quality, NOT the premium xAI x_search feed. So on the grok harness
// XAI_API_KEY is not required to get output; we drop the dashboard's "needs key" gate
// there (only there — claude skills still declare it). The runtime half lives in
// harness-adapter/lib/compat-rules.md, whose `--rules` tell the model to fetch X via WebSearch
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
  { label: 'All', value: -1 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

// The skill vocabulary. A skill's `category` IS its pack — one grouping, no
// separate axis (see docs/skill-packs.md), so PACKS below is this same list.
// Mirrors the `categories` map in bin/generate-skills-json and the `category`
// field baked into skills.json. `lab` (category `other`) is the catch-all and
// isn't author-selectable, so it's absent here.
export const CATEGORIES: { key: string; label: string; short: string; color: string }[] = [
  { key: 'core', label: 'Core', short: 'Core', color: '#E5484D' },
  { key: 'evolution', label: 'Evolution', short: 'Evolution', color: '#A855F7' },
  { key: 'basics', label: 'Basics', short: 'Basics', color: '#30A46C' },
  { key: 'dev', label: 'Dev & Code', short: 'Dev', color: '#3B82F6' },
  { key: 'crypto', label: 'Crypto & Markets', short: 'Crypto', color: '#FF6B1A' },
  { key: 'productivity', label: 'Productivity', short: 'Productivity', color: '#06B6D4' },
]

// First-party packs — the organizing unit across the dashboard (sidebar groups,
// HQ cards, Packs view). Because category == pack (one grouping), packs ARE the
// CATEGORIES list above, kept as one source of truth so the two can't drift.
// A skill's pack comes from its `pack` field (joined from packs.json in
// /api/skills); `lab` is the catch-all for uncategorized skills. Order drives the
// dashboard's non-default pack order (Core, Evolution + Basics render first via DEFAULT_VISIBLE_PACKS).
const PACKS = CATEGORIES

export const PACK_BY_KEY: Record<string, { label: string; color: string }> = Object.fromEntries(
  PACKS.map(p => [p.key, { label: p.label, color: p.color }]),
)

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

export interface PackGroup {
  key: string
  label: string
  short: string
  color: string
  community: boolean
}

// Build the ordered roster/HQ group list from whatever packs the given skills
// actually belong to — driven by data, not a hardcoded list, so a skill in a
// community pack (`installed`, or a per-source pack like `antfleet-pr-review`)
// renders instead of vanishing. Order: Core, then community packs (the things
// you installed, surfaced up top), then the rest of the first-party packs.
// Community labels come from the skill's joined `packName` (falling back to the
// key). Only packs that actually contain skills appear.
export function packGroups(skills: { pack?: string; packName?: string }[]): PackGroup[] {
  const present = new Set(skills.map(s => s.pack || 'lab'))
  const firstParty = PACKS.filter(p => present.has(p.key)).map(p => ({
    key: p.key,
    label: p.label,
    short: p.short,
    color: p.color,
    community: false,
  }))
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
