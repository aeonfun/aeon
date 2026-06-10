export interface SkillKeyRef { key: string; optional: boolean }
export interface SkillMcpRef { slug: string; optional: boolean }
export interface Skill { name: string; description: string; tags: string[]; category: string; enabled: boolean; schedule: string; var: string; model: string; requires: SkillKeyRef[]; mcp: SkillMcpRef[] }
export interface Run { id: number; workflow: string; status: string; conclusion: string | null; created_at: string; url: string }
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
// (see scripts/llm-gateway.sh). The rest pin a single provider explicitly.
export type GatewayProvider = 'auto' | 'direct' | 'bankr' | 'openrouter' | 'usepod' | 'venice' | 'surplus'

export const GATEWAY_PROVIDERS: GatewayProvider[] = ['auto', 'direct', 'bankr', 'openrouter', 'usepod', 'venice', 'surplus']

export interface UploadFile { path: string; content: string }

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
