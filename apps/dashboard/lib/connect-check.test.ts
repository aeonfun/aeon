import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { extractRunOutput, interpretRun, matchRun, parseUsage, pollConnectCheck, type CheckResult } from './connect-check'
import { reportsTokenUsage } from './manifest'

// --- the real shape ----------------------------------------------------------------
// fixtures/connect-check-run.log is the structural skeleton of a real
// `gh run view --log` (gh 2.102, a claude subscription run with 22,584 tokens):
// every line says "UNKNOWN STEP" in the step column, script blocks are
// ##[group]Run ... ##[endgroup], and the Run step's output ends with
//   <harness stderr tail> / echo "$RESULT_TEXT" / ##[notice]Token usage ...
// Content lines are replaced with neutral text.
const REAL = readFileSync(join(__dirname, 'fixtures', 'connect-check-run.log'), 'utf8')
const realLines = REAL.split('\n')
const noticeAt = realLines.findIndex((l) => l.includes('##[notice]Token usage'))
const tsOf = (l: string) => l.split('\t')[2].split(' ')[0]
const at = (i: number, text: string) => `run\tUNKNOWN STEP\t${tsOf(realLines[i])} ${text}`
// The real log with the result line (right before the notice) and the usage
// numbers swapped.
function realRun(opts: { reply?: string; usage?: [number, number, number, number] } = {}): string {
  const lines = [...realLines]
  if (opts.reply !== undefined) lines[noticeAt - 1] = at(noticeAt - 1, opts.reply)
  if (opts.usage) {
    const [i, o, cr, cc] = opts.usage
    lines[noticeAt] = at(noticeAt, `##[notice]Token usage - input: ${i}, output: ${o}, cache_read: ${cr}, cache_creation: ${cc}, total: ${i + o}`)
  }
  return lines.join('\n')
}
// A run that died before the Run step (checkout failed): no usage notice.
const runHeaderAt = realLines.findIndex((l) => l.includes('##[group]Run set -euo pipefail'))
const failedEarly = [...realLines.slice(0, 40), at(39, '##[error]The process git failed with exit code 128')].join('\n')

const facts = (over: Partial<Parameters<typeof interpretRun>[0]>) =>
  ({ status: 'completed', conclusion: 'success', log: '', harness: 'claude', secretsSet: [], ...over })
// The workflow's notice text uses a long dash after "Token usage".
const LONG_DASH = String.fromCharCode(0x2014)

describe('connect-check on the real gh log shape (UNKNOWN STEP)', () => {
  it('the fixture has the real structure', () => {
    assert.ok(realLines.every((l) => !l || l.split('\t')[1] === 'UNKNOWN STEP'))
    assert.ok(runHeaderAt > 0 && noticeAt > runHeaderAt)
    assert.ok(realLines.some((l) => l.includes('$INPUT_TOKENS')), 'script echo of the notice template is kept')
  })

  it('a real successful run passes with its token count', () => {
    const out = extractRunOutput(REAL)
    assert.equal(out.reachedModel, true)
    // total is the notice's own figure (input + output), as printed in the log.
    assert.deepEqual(parseUsage(out.run), { input: 2936, output: 19648, cacheRead: 3251450, cacheCreation: 58568, total: 22584 })
    assert.match(interpretRun(facts({ log: REAL })).reason!, /\(22584 tokens\)/)
    assert.doesNotMatch(out.run, /INPUT_TOKENS|##\[group\]/)
    const r = interpretRun(facts({ log: REAL, secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
    assert.equal(r.state, 'pass')
    assert.equal(r.fix, undefined)
  })

  it('reads the reply from the line right before the notice', () => {
    assert.equal(extractRunOutput(realRun({ reply: 'AEON_CONNECT_OK' })).reply, 'AEON_CONNECT_OK')
    assert.doesNotMatch(interpretRun(facts({ log: realRun({ reply: 'AEON_CONNECT_OK' }) })).reason!, /expected reply/)
    // An empty RESULT_TEXT prints an empty line there: no reply.
    assert.equal(extractRunOutput(realRun({ reply: '' })).reply, null)
  })

  it('the same run with zero usage fails with the subscription hint and fix', () => {
    const r = interpretRun(facts({ log: realRun({ usage: [0, 0, 0, 0] }), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
    assert.equal(r.state, 'fail')
    assert.match(r.reason!, /zero model usage/)
    assert.match(r.hint!, /Remove CLAUDE_CODE_OAUTH_TOKEN/)
    assert.equal(r.fix?.secret, 'CLAUDE_CODE_OAUTH_TOKEN')
  })

  it('a run that failed before the model call fails WITHOUT the remove-token fix', () => {
    const out = extractRunOutput(failedEarly)
    assert.equal(out.reachedModel, false)
    assert.equal(out.run, '')
    assert.match(out.problems, /exit code 128/)
    for (const conclusion of ['failure', 'success']) {
      const r = interpretRun(facts({ conclusion, log: failedEarly, secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
      assert.equal(r.state, 'fail')
      assert.equal(r.fix, undefined, conclusion)
      assert.doesNotMatch(r.hint ?? '', /CLAUDE_CODE_OAUTH_TOKEN/, conclusion)
    }
  })

  it('works on a logs zip without job/step columns too', () => {
    const zipText = REAL.split('\n').map((l) => l.split('\t').slice(2).join('\t')).join('\n')
    const out = extractRunOutput(zipText)
    assert.equal(parseUsage(out.run)?.input, 2936)
    assert.equal(interpretRun(facts({ log: zipText })).state, 'pass')
  })
})

// --- named steps (fast path) and edge cases -----------------------------------------
const T = '2026-10-02T10:00:00.0000000Z '
const line = (step: string, text: string) => `run\t${step}\t${T}${text}`
// The Run script mentions rate_limited / api_error (the health scorer prompt)
// and echoes the usage notice template; none of it is output.
const SCRIPT = [
  line('Run', '##[group]Run set -euo pipefail'),
  line('Run', 'Flag any issues from: api_error, empty_output, low_quality, rate_limited, unverifiable_claim'),
  line('Run', 'echo "::notice::Token usage - model: X, input: $INPUT_TOKENS, output: $OUTPUT_TOKENS"'),
  line('Run', 'echo "AEON_CONNECT_OK if you see this it is the script"'),
  line('Run', '##[endgroup]'),
]
const usageLine = (i: number, o: number, cr = 0, cc = 0) =>
  line('Run', `##[notice]Token usage - model: claude-sonnet-5-5, input: ${i}, output: ${o}, cache_read: ${cr}, cache_creation: ${cc}, total: ${i + o}`)
const runLog = (...out: string[]) => [line('Set up job', 'Current runner version'), ...SCRIPT, ...out, line('Post Run', '##[group]Run cleanup'), line('Post Run', 'rate_limited 429'), line('Post Run', '##[endgroup]')].join('\n')

describe('connect-check log slicing', () => {
  it('keeps only the Run step output plus error/warning annotations', () => {
    const out = extractRunOutput(runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(1, 1), line('Resolve harness', '##[error]grok harness needs auth')))
    assert.match(out.run, /^AEON_CONNECT_OK\n##\[notice\]Token usage/)
    assert.equal(out.reply, 'AEON_CONNECT_OK')
    assert.equal(out.problems, '##[error]grok harness needs auth')
    assert.doesNotMatch(out.run, /rate_limited|INPUT_TOKENS/)
  })

  it('reads the token usage notice (last one wins), in either log form', () => {
    assert.deepEqual(parseUsage(extractRunOutput(runLog(usageLine(12, 3, 100, 5))).run), { input: 12, output: 3, cacheRead: 100, cacheCreation: 5, total: 15 })
    const raw = `::notice::Token usage ${LONG_DASH} model: x, input: 7, output: 1, cache_read: 0, cache_creation: 0, total: 8`
    assert.equal(parseUsage(raw)?.total, 8)
    assert.equal(parseUsage(`${usageLine(1, 1)}\n${usageLine(0, 0)}`)?.total, 0)
    // No total field: fall back to input + output.
    assert.equal(parseUsage('##[notice]Token usage - input: 4, output: 6, cache_read: 900')?.total, 10)
    assert.equal(parseUsage('nothing here'), null)
  })
})

describe('connect-check result parser', () => {
  it('passes only on success with nonzero usage', () => {
    const r = interpretRun(facts({ log: runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(20, 4)) }))
    assert.equal(r.state, 'pass')
    assert.equal(r.usage?.total, 24)
    assert.match(interpretRun(facts({ log: runLog(usageLine(20, 4)) })).reason!, /expected reply/)
  })

  it('does not read the workflow script as a failure (zero usage is not "rate limited")', () => {
    const r = interpretRun(facts({ log: runLog(usageLine(0, 0)), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
    assert.equal(r.state, 'fail')
    assert.doesNotMatch(`${r.reason} ${r.hint}`, /rate/i)
    assert.match(r.hint!, /subscription token/)
  })

  it('tells the operator to REMOVE the subscription token and offers the one-click fix', () => {
    const alone = interpretRun(facts({ log: runLog(usageLine(0, 0)), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
    assert.match(alone.hint!, /Remove CLAUDE_CODE_OAUTH_TOKEN, then connect an API key or OpenRouter/)
    assert.deepEqual(alone.fix, { kind: 'remove-secret', secret: 'CLAUDE_CODE_OAUTH_TOKEN', label: 'Remove subscription token' })
    const withKey = interpretRun(facts({ log: runLog(usageLine(0, 0)), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN', 'OPENROUTER_API_KEY'] }))
    assert.match(withKey.hint!, /before your other key \(OPENROUTER_API_KEY\)\. Remove CLAUDE_CODE_OAUTH_TOKEN/)
    assert.equal(interpretRun(facts({ log: runLog(usageLine(0, 0)), harness: 'pi', secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] })).fix, undefined)
    // A failed run is never blamed on the token, even with zero usage.
    assert.equal(interpretRun(facts({ conclusion: 'failure', log: runLog(line('Run', 'boom'), usageLine(0, 0)), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] })).fix, undefined)
  })

  it('judges harnesses without real token counts by the reply (manifest token_usage: none)', () => {
    assert.equal(reportsTokenUsage('cursor'), false)
    assert.equal(reportsTokenUsage('kimi'), false)
    assert.equal(reportsTokenUsage('vibe'), false)
    assert.equal(reportsTokenUsage('claude'), true)
    assert.equal(interpretRun(facts({ harness: 'cursor', usageReported: false, log: runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(0, 0)) })).state, 'pass')
    // A harness that echoes the prompt / SKILL.md (which contains the sentinel
    // on its own line) in its stderr tail but returns no result must NOT pass:
    // the empty RESULT_TEXT echo is the line before the notice.
    const echoed = runLog(
      line('Run', 'run skill connect-check'),
      line('Run', 'Reply with exactly this single line as your final message:'),
      line('Run', 'AEON_CONNECT_OK'),
      line('Run', ''),
      usageLine(0, 0),
    )
    assert.equal(extractRunOutput(echoed).reply, null)
    assert.equal(interpretRun(facts({ harness: 'cursor', usageReported: false, log: echoed })).state, 'fail')
    const other = runLog(line('Run', 'AEON_CONNECT_OK'), line('Run', 'model said something else'), usageLine(0, 0))
    assert.equal(interpretRun(facts({ harness: 'vibe', usageReported: false, log: other })).state, 'fail')
    assert.equal(extractRunOutput(runLog(line('Run', 'AEON_CONNECT_OK'))).reply, null)
    assert.equal(interpretRun(facts({ harness: 'kimi', usageReported: false, log: runLog(line('Run', 'AEON_CONNECT_OK')) })).state, 'fail')
    assert.equal(interpretRun(facts({ harness: 'kimi', usageReported: false, log: runLog(usageLine(50, 9)) })).state, 'fail')
  })

  it('maps real failure output to concrete next steps', () => {
    const cases: [string, RegExp][] = [
      [line('Run', '##[error]run-harness claude failed: 401 {"type":"authentication_error"}'), /fresh key/],
      [line('Run', '##[error]insufficient_quota: You exceeded your current quota'), /Top up/],
      [line('Run', '##[error]HTTP 429 rate limit'), /Wait a minute/],
      [line('Run', '##[error]model_not_found: the model does not exist'), /another model/],
      [line('Resolve harness', '##[error]grok harness needs auth: set GROK_CREDENTIALS'), /saved under the right name/],
    ]
    for (const [l, hint] of cases) {
      const r = interpretRun(facts({ conclusion: 'failure', log: runLog(l) }))
      assert.equal(r.state, 'fail', l)
      assert.match(r.hint!, hint, l)
    }
    // Plain (non-annotation) output only counts inside the sliced Run output.
    assert.match(interpretRun(facts({ conclusion: 'failure', log: runLog(line('Run', 'Error: 401 unauthorized'), usageLine(0, 0)) })).hint!, /fresh key/)
    assert.match(interpretRun(facts({ conclusion: 'failure', log: runLog(line('Run', 'boom')) })).hint!, /run log/)
    assert.equal(interpretRun(facts({ conclusion: 'cancelled' })).state, 'fail')
  })

  it('reports in-flight runs', () => {
    assert.equal(interpretRun(facts({ status: 'queued', conclusion: null })).state, 'queued')
    assert.equal(interpretRun(facts({ status: 'in_progress', conclusion: null })).state, 'running')
  })

  it('finds a run by dispatch id, or the newest for a harness', () => {
    const runs = [
      { displayTitle: 'skill: heartbeat', id: 1 },
      { displayTitle: 'skill: connect-check [dispatch: cc-codex-aaa]', id: 2 },
      { displayTitle: 'skill: connect-check [dispatch: cc-claude-bbb]', id: 3 },
      { displayTitle: 'skill: connect-check [dispatch: cc-claude-ccc]', id: 4 },
    ]
    assert.equal(matchRun(runs, { dispatchId: 'cc-claude-ccc', harness: 'claude' })?.id, 4)
    assert.equal(matchRun(runs, { harness: 'claude' })?.id, 3)
    assert.equal(matchRun(runs, { harness: 'pi' }), undefined)
  })
})

describe('page-level connect-check polling', () => {
  // A fake clock: sleep() advances it instantly.
  const clock = () => {
    let t = 0
    return { now: () => t, sleep: async (ms: number) => { t += ms } }
  }

  it('follows a run to its verdict after the modal is gone', async () => {
    const states: CheckResult[] = [{ state: 'queued' }, { state: 'running' }, { state: 'pass', reason: 'ok' }]
    const seen: string[] = []
    const final = await pollConnectCheck({ read: async () => states.shift()!, onUpdate: (r) => seen.push(r.state), cancelled: () => false, ...clock() })
    assert.equal(final.state, 'pass')
    assert.deepEqual(seen, ['queued', 'running', 'pass'])
  })

  it('gives up with a fail after the timeout instead of spinning forever', async () => {
    const c = clock()
    const seen: string[] = []
    const final = await pollConnectCheck({ read: async () => ({ state: 'running' }), onUpdate: (r) => seen.push(r.state), cancelled: () => false, intervalMs: 5000, timeoutMs: 20_000, ...c })
    assert.equal(final.state, 'fail')
    assert.match(final.reason!, /too long/)
    assert.ok(c.now() <= 25_000)
    assert.equal(seen.at(-1), 'fail')
  })

  it('stops quietly when cancelled and fails after repeated read errors', async () => {
    let reads = 0
    let stop = false
    await pollConnectCheck({ read: async () => { reads++; stop = true; return { state: 'running' } }, onUpdate: () => {}, cancelled: () => stop, ...clock() })
    assert.equal(reads, 1)
    const broken = await pollConnectCheck({ read: async () => { throw new Error('down') }, onUpdate: () => {}, cancelled: () => false, ...clock() })
    assert.equal(broken.state, 'fail')
    assert.match(broken.reason!, /Lost contact/)
  })
})
