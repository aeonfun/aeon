// Reading a `connect-check` run: did the saved credential really reach a model
// from a GitHub runner? PURE (no I/O) so it is unit-tested and shared with the
// hosted fork; lib/connect-check-server.ts does the gh calls.
//
// Green needs BOTH a successful run AND nonzero model usage. Usage comes from
// the workflow's Run step, which prints
//   ::notice::Token usage - model: X, input: N, output: N, cache_read: N, cache_creation: N, total: N
// (rendered as "##[notice]Token usage ..." in downloaded logs). A Claude
// subscription token rejected at the Anthropic edge exits "successfully" with
// zero usage (docs/CONFIGURATION.md), which is exactly the case this catches.

export const CONNECT_CHECK_SKILL = 'connect-check'
export const CONNECT_OK = 'AEON_CONNECT_OK'

export type CheckState = 'none' | 'queued' | 'running' | 'pass' | 'fail'

export interface Usage { input: number; output: number; cacheRead: number; cacheCreation: number; total: number }

export interface CheckResult {
  state: CheckState
  reason?: string
  // A concrete next step for the operator when the check fails.
  hint?: string
  usage?: Usage
  runId?: number
  runUrl?: string
}

// The last "Token usage" line in the log (one per run; last wins on retries).
export function parseUsage(log: string): Usage | null {
  const re = /Token usage\b[^\n]*?input:\s*(\d+),\s*output:\s*(\d+)(?:,\s*cache_read:\s*(\d+))?(?:,\s*cache_creation:\s*(\d+))?/g
  let m: RegExpExecArray | null
  let last: RegExpExecArray | null = null
  while ((m = re.exec(log))) last = m
  if (!last) return null
  const [input, output, cacheRead, cacheCreation] = [1, 2, 3, 4].map((i) => Number(last![i] || 0))
  return { input, output, cacheRead, cacheCreation, total: input + output + cacheRead + cacheCreation }
}

const SUBSCRIPTION_HINT = 'GitHub servers rejected the subscription token. Use an API key or connect OpenRouter instead.'

// Known failure signatures, most specific first. Reasons are our own words:
// never echo log text back, it can carry provider responses.
const SIGNATURES: { re: RegExp; reason: string; hint: string }[] = [
  { re: /\b401\b|invalid[ _-]?(api[ _-]?)?key|invalid x-api-key|authentication_error|unauthori[sz]ed|token (has )?expired|invalid_grant/i,
    reason: 'The provider rejected the credential.', hint: 'Paste a fresh key or log in again, then test again.' },
  { re: /\b402\b|insufficient[ _](credits|funds|balance|quota)|credit balance is too low|exceeded your current quota|payment required/i,
    reason: 'The provider account is out of credit.', hint: 'Top up the account or connect a different key.' },
  { re: /\b429\b|rate[ _-]?limit/i,
    reason: 'The provider rate-limited the run.', hint: 'Wait a minute and test again.' },
  { re: /model[^\n]{0,40}(not found|does not exist|not available)|unknown model|invalid model|model_not_found/i,
    reason: 'The selected model is not available with this credential.', hint: 'Pick another model in the top bar, then test again.' },
  { re: /needs auth|harness needs|no (provider|model) (key|credential)|is not set|not valid base64|failed to extract/i,
    reason: 'The runner found no usable credential for this harness.', hint: 'Check the secret was saved under the right name, or connect again.' },
]

export interface RunFacts {
  status: string
  conclusion: string | null
  log: string
  harness: string
  // Names of the repo secrets that are set; used to explain zero usage.
  secretsSet: string[]
}

export function interpretRun(run: RunFacts): CheckResult {
  if (run.status !== 'completed') {
    return { state: run.status === 'in_progress' ? 'running' : 'queued' }
  }
  const usage = parseUsage(run.log) ?? undefined
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') {
    return { state: 'fail', usage, reason: `The run was ${run.conclusion}.`, hint: 'Start the test again.' }
  }
  if (run.conclusion === 'success' && usage && usage.total > 0) {
    const answered = run.log.includes(CONNECT_OK)
    return { state: 'pass', usage, reason: `The model answered from GitHub (${usage.total} tokens)${answered ? '' : ', though not with the expected reply'}.` }
  }

  const sig = SIGNATURES.find((s) => s.re.test(run.log))
  const subscription = run.harness === 'claude' && run.secretsSet.includes('CLAUDE_CODE_OAUTH_TOKEN')
  if (run.conclusion === 'success') {
    // Finished green but no model call happened.
    if (sig) return { state: 'fail', usage, reason: `The run made no model call. ${sig.reason}`, hint: sig.hint }
    if (subscription) return { state: 'fail', usage, reason: 'The run finished with zero model usage.', hint: SUBSCRIPTION_HINT }
    return { state: 'fail', usage, reason: 'The run finished with zero model usage.', hint: 'Open the run log. If the key looks right, try an API key or OpenRouter.' }
  }
  if (sig) return { state: 'fail', usage, reason: sig.reason, hint: sig.hint }
  if (subscription && (!usage || usage.total === 0)) {
    return { state: 'fail', usage, reason: 'The run failed before the model answered.', hint: SUBSCRIPTION_HINT }
  }
  return { state: 'fail', usage, reason: 'The run failed.', hint: 'Open the run log for the error, fix it, and test again.' }
}

// The workflow's run-name ends with "[dispatch: <id>]" when dispatch_id is set,
// so a dispatch is found again by title. Ids are "cc-<harness>-<random>".
export const dispatchTag = (id: string) => `[dispatch: ${id}]`
export const harnessTagPrefix = (harness: string) => `[dispatch: cc-${harness}-`

export function matchRun<T extends { displayTitle: string }>(runs: T[], opts: { dispatchId?: string; harness: string }): T | undefined {
  return opts.dispatchId
    ? runs.find((r) => r.displayTitle.includes(dispatchTag(opts.dispatchId!)))
    : runs.find((r) => r.displayTitle.startsWith(`skill: ${CONNECT_CHECK_SKILL}`) && r.displayTitle.includes(harnessTagPrefix(opts.harness)))
}
