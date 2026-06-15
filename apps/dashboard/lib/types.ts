import { GATEWAY_SLUGS, type GatewaySlug } from './gateway-registry'

export interface SkillKeyRef { key: string; optional: boolean }
export interface SkillMcpRef { slug: string; optional: boolean }
export interface Skill { name: string; description: string; tags: string[]; category: string; pack: string; enabled: boolean; schedule: string; var: string; model: string; requires: SkillKeyRef[]; mcp: SkillMcpRef[] }
export interface Run { id: number; workflow: string; status: string; conclusion: string | null; created_at: string; url: string }

// --- Skill packs ---
// A skill inside a first-party pack, joined with its live enabled state from
// aeon.yml. `slug` is the skill dir name; `name` is the display name.
export interface PackSkill { slug: string; name: string; description: string; category: string; enabled: boolean }
// First-party pack (from packs.json) with live counts computed by /api/packs.
export interface Pack {
  key: string
  name: string
  description: string
  color: string
  category: string | null
  default_enabled: string[]
  skills: PackSkill[]
  total: number
  enabled: number
}
// Community pack (from skill-packs.json), browse-only in the dashboard.
export interface CommunityPack {
  repo: string
  path?: string
  name: string
  description: string
  author: string
  license?: string
  homepage?: string
  category: string
  trust_level?: string
  skills: string[]
  secrets_required?: string[]
  capabilities?: string[]
  installedCount: number
}
export interface Secret { name: string; group: string; description: string; isSet: boolean; either?: string }
export interface SkillOutput { filename: string; skill: string; timestamp: string; spec: { root: string; state?: Record<string, unknown>; elements: Record<string, SpecElement> } }
export interface SpecElement { type: string; props?: Record<string, unknown>; children?: string[] }

// Shape of `gh run list`/`gh run view --json` output. Routes Pick<> the columns they request.
export interface GhRunJson {
  databaseId: number
  name: string
  status: string
  conclusion: string | null
  createdAt: string
  updatedAt: string
  url: string
  displayTitle: string
  event: string
  jobs: Array<{ name: string; status: string; conclusion: string | null }>
}

// `auto` resolves the provider at run time from whichever secret is set
// (see scripts/llm-gateway.sh); `direct` is no gateway. Named providers come from
// the gateway registry - add new ones there, not here.
export type GatewayProvider = 'auto' | 'direct' | GatewaySlug

export const GATEWAY_PROVIDERS: GatewayProvider[] = ['auto', 'direct', ...GATEWAY_SLUGS]

export interface UploadFile { path: string; content: string }

// Client→server build briefs. The panels collect them; the build routes accept
// them as Partial (every field is untrusted/optional on the wire).
export interface SoulSources { handle: string; name: string; links: string }
export interface StrategySources { goal: string; repo: string; links: string }

// `.mcp.json` server map. A server's shape varies by transport (http/stdio),
// so each entry is an open record; consumers narrow fields as needed.
export type McpServer = Record<string, unknown>
export type McpServers = Record<string, McpServer>

export interface SkillMetrics {
  name: string
  total: number
  success: number
  failure: number
  cancelled: number
  inProgress: number
  successRate: number
  lastRun: string | null
  lastConclusion: string | null
  avgDurationMin: number | null
  streak: number // positive = consecutive successes, negative = consecutive failures
}

export interface Insight {
  type: 'warning' | 'info' | 'success'
  message: string
}

interface AnalyticsSummary {
  totalRuns: number
  totalSuccess: number
  totalFailure: number
  overallSuccessRate: number
  uniqueSkills: number
  periodDays: number
}

export interface AnalyticsData {
  skills: SkillMetrics[]
  insights: Insight[]
  summary: AnalyticsSummary
}

// --- Client-facing API response shapes ---
// Narrow views of what the API routes' NextResponse.json(...) actually return,
// for the fetch reads in app/page.tsx. Fields a route may omit stay optional so
// the casts don't introduce false non-null assumptions.

// GET /api/skills
export interface SkillsResponse {
  skills: Skill[]
  model?: string
  gateway?: { provider: GatewayProvider }
  repo?: string
  jsonrenderEnabled?: boolean
}

// GET /api/runs
export interface RunsResponse {
  runs: Run[]
}

// GET /api/packs
export interface PacksResponse {
  firstParty: Pack[]
  community: CommunityPack[]
}

// GET /api/secrets
export interface SecretsResponse {
  secrets?: Secret[]
  ghReady?: boolean
}

// GET /api/sync
export interface SyncStatusResponse {
  hasChanges: boolean
  changedFiles?: number
  behind?: number
}

// GET /api/mcp
export interface McpResponse {
  exists?: boolean
  servers?: McpServers
  sha?: string
  raw?: string
}

// GET /api/outputs
export interface OutputsResponse {
  outputs?: SkillOutput[]
}

// GET /api/strategy
export interface StrategyResponse {
  exists?: boolean
  content?: string
  sha?: string
}

// GET /api/soul
export interface SoulResponse {
  soul?: { content: string; exists?: boolean }
  style?: { content: string; exists?: boolean }
}

// Standard write+sync body ({ ok, synced, syncError? }) from lib/http syncResult.
export interface SyncResult {
  ok?: boolean
  synced?: boolean
  syncError?: string
}

// POST /api/soul/examples - syncResult plus the installed file contents on
// success, or { error } on the not-found / failure paths.
export interface SoulExampleResponse extends SyncResult {
  soul?: string
  style?: string
  error?: string
}

// POST /api/upload
export interface UploadResponse {
  name: string
  filesWritten?: number
  detectedSecrets?: string[]
  configUpdated?: boolean
  configError?: string
  synced?: boolean
}

// Generic { error?: string } body returned on a route's non-OK paths.
export interface ErrorResponse {
  error?: string
}
