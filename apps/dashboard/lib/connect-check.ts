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
  // The Run step's printed output: from the end of its script block up to and
  // including the "Token usage" notice. Empty when there is no notice.
  run: string
  // ##[error] / ##[warning] lines from any step (outside script blocks).
  problems: string
  // The harness's final answer: the line printed right before the notice.
  // The workflow ends the Run step with `echo "$RESULT_TEXT"` followed by the
  // notice (.github/workflows/aeon.yml, Run step), with the harness stderr
  // tail printed BEFORE that echo, so only this one line is the answer; an
  // empty result prints an empty line here. null when there is no notice.
  reply: string | null
  // The Run step got as far as the model call (the usage notice is printed).
  reachedModel: boolean
}

// gh prefixes each line with "<ISO timestamp> "; a downloaded logs zip has
// the same per-line timestamps without the job/step columns.
const TS = /^﻿?\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/
// The Run step's usage notice, as rendered (##[notice]) or raw (::notice::).
// The script echo of the same command has `$INPUT_TOKENS`, not digits.
const USAGE_NOTICE = /^(##\[notice\]|::notice::)Token usage\b.*\binput:\s*\d+/

interface LogLine { step: string | null; text: string }

function normalize(log: string): LogLine[] {
  return log.split('\n').map((raw) => {
    const line = raw.replace(/\r$/, '')
    const parts = line.split('\t')
    return parts.length >= 3
      ? { step: parts[1], text: parts.slice(2).join('\t').replace(TS, '') }
      : { step: null, text: line.replace(TS, '') }
  })
}

// Drop ##[group] ... ##[endgroup] blocks (script echoes, env listings).
function outsideGroups(lines: LogLine[]): LogLine[] {
  const out: LogLine[] = []
  let depth = 0
  for (const l of lines) {
    if (l.text.startsWith('##[group]')) { depth++; continue }
    if (l.text.startsWith('##[endgroup]')) { depth = Math.max(0, depth - 1); continue }
    if (depth === 0) out.push(l)
  }
  return out
}

// Slice a run log down to what the connect check may read. Works on
// `gh run view --log` text (gh 2.10x prints "UNKNOWN STEP" in the step column
// for every line) and on a logs zip without per-step files: the slice is
// anchored on the LAST usage notice, and starts where the script block of the
// nearest preceding "##[group]Run " header ends. When real step names exist,
// only the "Run" step's lines are considered first (fast path).
export function extractRunOutput(log: string): RunOutput {
  const all = normalize(log)
  const problems = outsideGroups(all).map((l) => l.text).filter((t) => /^##\[(error|warning)\]/.test(t))
  const lines = all.some((l) => l.step === 'Run') ? all.filter((l) => l.step === 'Run') : all

  let notice = -1
  for (let i = lines.length - 1; i >= 0; i--) if (USAGE_NOTICE.test(lines[i].text)) { notice = i; break }
  if (notice < 0) return { run: '', problems: problems.join('\n'), reply: null, reachedModel: false }

  let header = -1
  for (let i = notice - 1; i >= 0; i--) if (lines[i].text.startsWith('##[group]Run ')) { header = i; break }
  let start = 0
  if (header >= 0) {
    start = header + 1
    for (let i = header + 1; i < notice; i++) if (lines[i].text.startsWith('##[endgroup]')) { start = i + 1; break }
  } else {
    for (let i = notice - 1; i >= 0; i--) if (lines[i].text.startsWith('##[endgroup]')) { start = i + 1; break }
  }
  const run = outsideGroups(lines.slice(start, notice + 1)).map((l) => l.text)
  const before = run.length >= 2 ? run[run.length - 2].trim() : ''
  return { run: run.join('\n'), problems: problems.join('\n'), reply: before || null, reachedModel: true }
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
    // Only blame (and offer to remove) the subscription token when the run
    // demonstrably reached the model call and got zero usage back.
    if (subscription && usageReported && out.reachedModel && (usage?.total ?? 0) === 0) {
      return { state: 'fail', usage, reason: what, ...subscriptionAdvice(run.secretsSet) }
    }
    return { state: 'fail', usage, reason: what, hint: 'Open the run log. If the key looks right, try an API key or OpenRouter.' }
  }
  if (sig) return { state: 'fail', usage, reason: sig.reason, hint: sig.hint }
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
