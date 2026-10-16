// Reading a failed skill run's log: why did it fail, in plain words, and what
// should the operator do next. PURE (no I/O) so it is unit-tested and shared with
// the hosted fork; lib/run-diagnosis-server.ts does the gh calls.
//
// Only the Run step's own output and ##[error]/##[warning] lines are read: the
// downloaded log also holds every step's script (##[group]Run ... blocks), and
// those scripts contain words like "rate_limited" that would match a failure
// signature on every run.

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  total: number
}

export interface Diagnosis {
  // One plain sentence: what went wrong.
  reason: string
  // A concrete next step for the operator.
  hint: string
  // The credential is the problem, so the UI offers Connect for `harness`.
  credential: boolean
  // The harness the run used ("Using harness: X" in the Run output), if printed.
  harness?: string
  usage?: Usage
}

// --- log slicing ---------------------------------------------------------------

export interface RunOutput {
  // The failing step's printed output: from the end of its script block up to
  // and including the "Token usage" notice, or, when the run died before that
  // notice, up to the first ##[error] line. Empty when there is neither.
  run: string
  // ##[error] / ##[warning] lines from any step (outside script blocks).
  problems: string
  // The Run step got as far as the model call (the usage notice is printed).
  reachedModel: boolean
  // From the Run step's "Using harness: X | model: Y" banner, else the
  // "effective model for X:" notice; null if neither is printed.
  harness: string | null
}

// gh prefixes each line with "<ISO timestamp> "; a downloaded logs zip has
// the same per-line timestamps without the job/step columns.
const TS = /^﻿?\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/
// The Run step's usage notice, as rendered (##[notice]) or raw (::notice::).
// The script echo of the same command has `$INPUT_TOKENS`, not digits.
const USAGE_NOTICE = /^(##\[notice\]|::notice::)Token usage\b.*\binput:\s*\d+/
// The Run step prints this once it has picked the harness.
const HARNESS_BANNER = /^Using harness:\s*([a-z]+)\b/
// Fallback when the banner is missing: "::notice::effective model for X: M",
// printed after the harness call (every harness but grok).
const HARNESS_NOTICE = /^(?:##\[notice\]|::notice::)effective model for ([a-z]+):/

interface LogLine {
  step: string | null
  text: string
}

function normalize(log: string): LogLine[] {
  return log.split('\n').map(raw => {
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
    if (l.text.startsWith('##[group]')) {
      depth++
      continue
    }
    if (l.text.startsWith('##[endgroup]')) {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0) out.push(l)
  }
  return out
}

// Slice a run log down to what the diagnosis may read. Works on
// `gh run view --log` text (gh 2.10x prints "UNKNOWN STEP" in the step column
// for every line) and on a logs zip without per-step files: the slice is
// anchored on the LAST usage notice (or, when the run failed before printing
// it, on the FIRST ##[error] line, so a harness that died on a revoked login
// still has its own output read), and starts where the script block of the
// nearest preceding "##[group]Run " header ends. When real step names exist,
// only the "Run" step's lines are considered first (fast path).
export function extractRunOutput(log: string): RunOutput {
  const all = normalize(log)
  const outside = outsideGroups(all).map(l => l.text)
  const problems = outside.filter(t => /^##\[(error|warning)\]/.test(t))
  let banner: string | null = null
  let effective: string | null = null
  for (const t of outside) {
    banner = HARNESS_BANNER.exec(t)?.[1] ?? banner
    effective = HARNESS_NOTICE.exec(t)?.[1] ?? effective
  }
  const harness = banner ?? effective
  const lines = all.some(l => l.step === 'Run') ? all.filter(l => l.step === 'Run') : all

  let anchor = -1
  for (let i = lines.length - 1; i >= 0; i--)
    if (USAGE_NOTICE.test(lines[i].text)) {
      anchor = i
      break
    }
  const reachedModel = anchor >= 0
  if (!reachedModel) anchor = lines.findIndex(l => l.text.startsWith('##[error]'))
  if (anchor < 0) return { run: '', problems: problems.join('\n'), reachedModel, harness }

  let header = -1
  for (let i = anchor - 1; i >= 0; i--)
    if (lines[i].text.startsWith('##[group]Run ')) {
      header = i
      break
    }
  let start = 0
  if (header >= 0) {
    start = header + 1
    for (let i = header + 1; i < anchor; i++)
      if (lines[i].text.startsWith('##[endgroup]')) {
        start = i + 1
        break
      }
  } else {
    for (let i = anchor - 1; i >= 0; i--)
      if (lines[i].text.startsWith('##[endgroup]')) {
        start = i + 1
        break
      }
  }
  const run = outsideGroups(lines.slice(start, anchor + 1)).map(l => l.text)
  return { run: run.join('\n'), problems: problems.join('\n'), reachedModel, harness }
}

// The last "Token usage" line (one per run; last wins on retries).
export function parseUsage(text: string): Usage | null {
  const re =
    /Token usage\b[^\n]*?input:\s*(\d+),\s*output:\s*(\d+)(?:,\s*cache_read:\s*(\d+))?(?:,\s*cache_creation:\s*(\d+))?(?:,\s*total:\s*(\d+))?/g
  let m: RegExpExecArray | null
  let last: RegExpExecArray | null = null
  while ((m = re.exec(text))) last = m
  if (!last) return null
  const [input, output, cacheRead, cacheCreation] = [1, 2, 3, 4].map(i => Number(last![i] || 0))
  // `total` is the notice's own figure (input + output, as the workflow
  // prints it), so the text we show matches the run log.
  const total = last[5] !== undefined ? Number(last[5]) : input + output
  return { input, output, cacheRead, cacheCreation, total }
}

// Known failure signatures, most specific first. Reasons are our own words:
// never echo log text back, it can carry provider responses.
const SIGNATURES: { re: RegExp; reason: string; hint: string; credential: boolean }[] = [
  {
    re: /token (has )?expired|invalid_grant|refresh token (is )?(invalid|expired|revoked)|session expired|token_revoked|invalidated oauth token/i,
    reason: 'The saved login expired.',
    hint: 'Log in again and connect the new login.',
    credential: true,
  },
  {
    re: /\b401\b|invalid[ _-]?(api[ _-]?)?key|invalid x-api-key|authentication_error|unauthori[sz]ed/i,
    reason: 'The provider rejected the credential.',
    hint: 'Paste a fresh key or log in again.',
    credential: true,
  },
  {
    re: /\b402\b|insufficient[ _](credits|funds|balance|quota)|credit balance is too low|exceeded your current quota|payment required/i,
    reason: 'The provider account is out of credit.',
    hint: 'Top up the account or connect a different key.',
    credential: true,
  },
  {
    re: /\b429\b|rate[ _-]?limit/i,
    reason: 'The provider rate-limited the run.',
    hint: 'Wait a minute and run the skill again.',
    credential: false,
  },
  {
    re: /model[^\n]{0,40}(not found|does not exist|not available)|unknown model|invalid model|model_not_found/i,
    reason: 'The selected model is not available with this credential.',
    hint: 'Pick another model in the top bar, then run the skill again.',
    credential: false,
  },
  {
    re: /needs auth|harness needs|no (provider|model) (key|credential)|is not set|not valid base64|failed to extract/i,
    reason: 'The runner found no usable credential for this harness.',
    hint: 'Check the secret was saved under the right name, or connect again.',
    credential: true,
  },
]

export interface RunFacts {
  conclusion: string | null
  log: string
}

// Why a finished run failed, or null when it did not fail.
export function diagnoseRun(run: RunFacts): Diagnosis | null {
  if (run.conclusion === 'success' || run.conclusion === 'skipped' || !run.conclusion) return null
  const out = extractRunOutput(run.log)
  const usage = parseUsage(out.run) ?? undefined
  const base = { usage, ...(out.harness ? { harness: out.harness } : {}) }
  if (run.conclusion === 'cancelled')
    return { ...base, reason: 'The run was cancelled.', hint: 'Run it again when ready.', credential: false }
  if (run.conclusion === 'timed_out')
    return {
      ...base,
      reason: 'The run hit its time limit.',
      hint: 'Run it again; if it keeps timing out, open the run log.',
      credential: false,
    }
  const sig = SIGNATURES.find(s => s.re.test(`${out.run}\n${out.problems}`))
  if (sig) return { ...base, reason: sig.reason, hint: sig.hint, credential: sig.credential }
  return { ...base, reason: 'The run failed.', hint: 'Open the run log for the error.', credential: false }
}
