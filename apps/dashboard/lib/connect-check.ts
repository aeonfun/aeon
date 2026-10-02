// Reading a `connect-check` run: did the saved credential really reach a model
// from a GitHub runner? PURE (no I/O) so it is unit-tested and shared with the
// hosted fork; lib/connect-check-server.ts does the gh calls.
//
// Green needs a successful run AND proof the model answered:
//   - harnesses that report real token counts (manifest token_usage != none):
//     nonzero usage from the Run step's
//       ::notice::Token usage - model: X, input: N, output: N, ...
//     (rendered "##[notice]Token usage ..." in downloaded logs). A Claude
//     subscription token rejected at the Anthropic edge exits "successfully"
//     with zero usage (docs/CONFIGURATION.md), which is exactly what this catches.
//   - harnesses that don't (cursor reports 0, kimi/vibe estimate from text):
//     the harness's final answer being exactly AEON_CONNECT_OK (see
//     RunOutput.reply: only the result line printed right before the usage
//     notice counts, never the prompt or SKILL.md echoed earlier in the log).
// Only the Run step's own output and ##[error]/##[warning] lines are read: the
// downloaded log also holds every step's script (##[group]Run ... blocks), and
// those scripts contain words like "rate_limited" that would match a failure
// signature on every run.

import { acceptedSecrets } from './connect-detect'

export const CONNECT_CHECK_SKILL = 'connect-check'
export const CONNECT_OK = 'AEON_CONNECT_OK'
export const SUBSCRIPTION_SECRET = 'CLAUDE_CODE_OAUTH_TOKEN'

export type CheckState = 'none' | 'queued' | 'running' | 'pass' | 'fail'

export interface Usage { input: number; output: number; cacheRead: number; cacheCreation: number; total: number }

export interface CheckResult {
  state: CheckState
  reason?: string
  // A concrete next step for the operator when the check fails.
  hint?: string
  // A one-click fix the UI can offer next to the hint.
  fix?: { kind: 'remove-secret'; secret: string; label: string }
  usage?: Usage
  runId?: number
  runUrl?: string
}

// --- log slicing ---------------------------------------------------------------

export interface RunOutput {
  // The Run step's printed output (scripts and env dumps removed).
  run: string
  // ##[error] / ##[warning] lines from any step.
  problems: string
  // The harness's final answer: the workflow prints the result text
  // (`echo "$RESULT_TEXT"`) as the Run step's last output right before the
  // "Token usage" notice, so it is the last non-empty line ahead of that
  // notice. null when there is no notice. Anything earlier (a harness echoing
  // the prompt or SKILL.md, stderr tails) can never count as the answer.
  reply: string | null
}

const TS = /^﻿?\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/

// Split a `gh run view --log` dump (lines are job<TAB>step<TAB>text) into the
// Run step's real output and the error/warning annotations. Each step's
// ##[group]...##[endgroup] blocks (the script echo, the env listing) are
// dropped. A log that is not in that shape is treated as all output.
export function extractRunOutput(log: string): RunOutput {
  const run: string[] = []
  const problems: string[] = []
  const inGroup = new Map<string, boolean>()
  let tabbed = false
  for (const line of log.split('\n')) {
    const parts = line.split('\t')
    if (parts.length < 3) continue
    tabbed = true
    const step = parts[1]
    const text = parts.slice(2).join('\t').replace(TS, '')
    if (text.startsWith('##[group]')) { inGroup.set(step, true); continue }
    if (text.startsWith('##[endgroup]')) { inGroup.set(step, false); continue }
    if (inGroup.get(step)) continue
    if (/^##\[(error|warning)\]/.test(text)) problems.push(text)
    if (step === 'Run') run.push(text)
  }
  const lines = tabbed ? run : log.split('\n').map((l) => l.replace(TS, ''))
  return { run: lines.join('\n'), problems: problems.join('\n'), reply: replyBeforeUsage(lines) }
}

function replyBeforeUsage(lines: string[]): string | null {
  let notice = -1
  for (let i = lines.length - 1; i >= 0; i--) if (/Token usage\b.*input:\s*\d+/.test(lines[i])) { notice = i; break }
  if (notice < 0) return null
  for (let i = notice - 1; i >= 0; i--) if (lines[i].trim()) return lines[i].trim()
  return null
}

// The last "Token usage" line (one per run; last wins on retries).
export function parseUsage(text: string): Usage | null {
  const re = /Token usage\b[^\n]*?input:\s*(\d+),\s*output:\s*(\d+)(?:,\s*cache_read:\s*(\d+))?(?:,\s*cache_creation:\s*(\d+))?/g
  let m: RegExpExecArray | null
  let last: RegExpExecArray | null = null
  while ((m = re.exec(text))) last = m
  if (!last) return null
  const [input, output, cacheRead, cacheCreation] = [1, 2, 3, 4].map((i) => Number(last![i] || 0))
  return { input, output, cacheRead, cacheCreation, total: input + output + cacheRead + cacheCreation }
}

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

// The subscription token is first in the claude gateway's auto order and a
// rejected one "succeeds" with zero usage, so the cascade never falls through
// to another key. The fix is removing it, not adding something else.
function subscriptionAdvice(secretsSet: string[]): Pick<CheckResult, 'hint' | 'fix'> {
  const others = acceptedSecrets('claude').filter((s) => s !== SUBSCRIPTION_SECRET && secretsSet.includes(s))
  return {
    hint: others.length
      ? `GitHub servers rejected the Claude subscription token, and runs try it before your other key (${others[0]}). Remove ${SUBSCRIPTION_SECRET} so runs use that key.`
      : `GitHub servers rejected the Claude subscription token. Remove ${SUBSCRIPTION_SECRET}, then connect an API key or OpenRouter.`,
    fix: { kind: 'remove-secret', secret: SUBSCRIPTION_SECRET, label: 'Remove subscription token' },
  }
}

export interface RunFacts {
  status: string
  conclusion: string | null
  log: string
  harness: string
  // Names of the repo secrets that are set; used to explain zero usage.
  secretsSet: string[]
  // From the manifest's token_usage; false = judge by the reply instead.
  usageReported?: boolean
}

export function interpretRun(run: RunFacts): CheckResult {
  if (run.status !== 'completed') {
    return { state: run.status === 'in_progress' ? 'running' : 'queued' }
  }
  const out = extractRunOutput(run.log)
  const usage = parseUsage(out.run) ?? undefined
  const answered = out.reply === CONNECT_OK
  const usageReported = run.usageReported !== false
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') {
    return { state: 'fail', usage, reason: `The run was ${run.conclusion}.`, hint: 'Start the test again.' }
  }
  if (run.conclusion === 'success') {
    if (usageReported && usage && usage.total > 0) {
      return { state: 'pass', usage, reason: `The model answered from GitHub (${usage.total} tokens)${answered ? '' : ', though not with the expected reply'}.` }
    }
    if (!usageReported && answered) {
      return { state: 'pass', usage, reason: 'The model answered from GitHub with the expected reply.' }
    }
  }

  const sig = SIGNATURES.find((s) => s.re.test(`${out.run}\n${out.problems}`))
  const subscription = run.harness === 'claude' && run.secretsSet.includes(SUBSCRIPTION_SECRET)
  if (run.conclusion === 'success') {
    // Finished green but the model never answered.
    const what = usageReported ? 'The run finished with zero model usage.' : 'The run finished without the expected reply from the model.'
    if (sig) return { state: 'fail', usage, reason: `${what} ${sig.reason}`, hint: sig.hint }
    if (subscription) return { state: 'fail', usage, reason: what, ...subscriptionAdvice(run.secretsSet) }
    return { state: 'fail', usage, reason: what, hint: 'Open the run log. If the key looks right, try an API key or OpenRouter.' }
  }
  if (sig) return { state: 'fail', usage, reason: sig.reason, hint: sig.hint }
  if (subscription && (!usage || usage.total === 0)) {
    return { state: 'fail', usage, reason: 'The run failed before the model answered.', ...subscriptionAdvice(run.secretsSet) }
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

// --- polling ---------------------------------------------------------------------

export const isSettled = (s: CheckState) => s === 'pass' || s === 'fail' || s === 'none'

export interface PollDeps {
  // GET /api/connect-check?harness=&id= ; throws on network trouble.
  read: () => Promise<CheckResult>
  onUpdate: (r: CheckResult) => void
  sleep: (ms: number) => Promise<void>
  now: () => number
  // Stop quietly (the page went away); checked between polls.
  cancelled: () => boolean
  intervalMs?: number
  timeoutMs?: number
}

// Poll one dispatch until it settles or times out, reporting every state.
// Owned by the page (not the modal) so closing the modal does not strand the
// HQ checklist on "in progress". Resolves with the last result.
export async function pollConnectCheck(deps: PollDeps): Promise<CheckResult> {
  const interval = deps.intervalMs ?? 5000
  const deadline = deps.now() + (deps.timeoutMs ?? 10 * 60_000)
  let last: CheckResult = { state: 'queued' }
  let errors = 0
  while (!deps.cancelled()) {
    await deps.sleep(interval)
    if (deps.cancelled()) break
    try {
      last = await deps.read()
      errors = 0
      deps.onUpdate(last)
      if (isSettled(last.state)) return last
    } catch {
      if (++errors >= 5) {
        last = { state: 'fail', reason: 'Lost contact with the dashboard server while testing.', hint: 'Reload and test again.' }
        deps.onUpdate(last)
        return last
      }
    }
    if (deps.now() >= deadline) {
      last = { ...last, state: 'fail', reason: 'The test is taking too long.', hint: 'Check the run on GitHub; Actions may be busy or disabled.' }
      deps.onUpdate(last)
      return last
    }
  }
  return last
}
