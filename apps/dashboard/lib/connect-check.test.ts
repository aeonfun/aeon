import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { extractRunOutput, interpretRun, matchRun, parseUsage, pollConnectCheck, type CheckResult } from './connect-check'
import { reportsTokenUsage } from './manifest'

// A `gh run view --log` dump: job<TAB>step<TAB>timestamped text, with each
// step's script echoed inside ##[group]...##[endgroup] the way GitHub logs it.
const T = '2026-10-02T10:00:00.0000000Z '
const line = (step: string, text: string) => `run\t${step}\t${T}${text}`
// The real workflow's Run script mentions rate_limited / api_error (the health
// scorer prompt) and echoes the usage notice template; none of it is output.
const SCRIPT = [
  line('Run', '##[group]Run set -euo pipefail'),
  line('Run', 'Flag any issues from: api_error, empty_output, low_quality, rate_limited, unverifiable_claim'),
  line('Run', '- api_error / rate_limited: ONLY when the error blocked the skill output'),
  line('Run', 'echo "::notice::Token usage - model: X, input: $INPUT_TOKENS, output: $OUTPUT_TOKENS"'),
  line('Run', 'echo "AEON_CONNECT_OK if you see this it is the script"'),
  line('Run', 'shell: /usr/bin/bash -e {0}'),
  line('Run', 'env:'),
  line('Run', '  HARNESS: claude'),
  line('Run', '##[endgroup]'),
]
const usageLine = (i: number, o: number, cr = 0, cc = 0) =>
  line('Run', `##[notice]Token usage - model: claude-sonnet-5-5, input: ${i}, output: ${o}, cache_read: ${cr}, cache_creation: ${cc}, total: ${i + o}`)
const runLog = (...out: string[]) => [line('Set up job', 'Current runner version'), ...SCRIPT, ...out, line('Post Run', '##[group]Run cleanup'), line('Post Run', 'rate_limited 429'), line('Post Run', '##[endgroup]')].join('\n')
const facts = (over: Partial<Parameters<typeof interpretRun>[0]>) =>
  ({ status: 'completed', conclusion: 'success', log: '', harness: 'claude', secretsSet: [], ...over })
// The workflow's notice text uses a long dash after "Token usage".
const LONG_DASH = String.fromCharCode(0x2014)

describe('connect-check log slicing', () => {
  it('keeps only the Run step output plus error/warning annotations', () => {
    const out = extractRunOutput(runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(1, 1), line('Resolve harness', '##[error]grok harness needs auth')))
    assert.match(out.run, /^AEON_CONNECT_OK\n##\[notice\]Token usage/)
    assert.equal(out.reply, 'AEON_CONNECT_OK')
    assert.equal(out.problems, '##[error]grok harness needs auth')
    assert.doesNotMatch(out.run, /rate_limited|INPUT_TOKENS/)
  })

  it('reads the token usage notice (last one wins), in either log form', () => {
    assert.deepEqual(parseUsage(extractRunOutput(runLog(usageLine(12, 3, 100, 5))).run), { input: 12, output: 3, cacheRead: 100, cacheCreation: 5, total: 120 })
    const raw = `::notice::Token usage ${LONG_DASH} model: x, input: 7, output: 1, cache_read: 0, cache_creation: 0, total: 8`
    assert.equal(parseUsage(raw)?.total, 8)
    assert.equal(parseUsage(`${usageLine(1, 1)}\n${usageLine(0, 0)}`)?.total, 0)
    assert.equal(parseUsage('nothing here'), null)
  })
})

describe('connect-check result parser', () => {
  it('passes only on success with nonzero usage', () => {
    const r = interpretRun(facts({ log: runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(20, 4)) }))
    assert.equal(r.state, 'pass')
    assert.equal(r.usage?.total, 24)
    assert.doesNotMatch(r.reason!, /expected reply/)
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
    assert.equal(withKey.fix?.secret, 'CLAUDE_CODE_OAUTH_TOKEN')
    // Not claude, or no subscription token set: no fix offered.
    assert.equal(interpretRun(facts({ log: runLog(usageLine(0, 0)), harness: 'pi', secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] })).fix, undefined)
  })

  it('judges harnesses without real token counts by the reply (manifest token_usage: none)', () => {
    assert.equal(reportsTokenUsage('cursor'), false)
    assert.equal(reportsTokenUsage('kimi'), false)
    assert.equal(reportsTokenUsage('vibe'), false)
    assert.equal(reportsTokenUsage('claude'), true)
    const ok = interpretRun(facts({ harness: 'cursor', usageReported: false, log: runLog(line('Run', 'AEON_CONNECT_OK'), usageLine(0, 0)) }))
    assert.equal(ok.state, 'pass')
    // A harness that echoes the prompt / SKILL.md (which contains the sentinel
    // on its own line) but never answers must NOT pass.
    const echoed = runLog(
      line('Run', 'run skill connect-check'),
      line('Run', 'Reply with exactly this single line as your final message:'),
      line('Run', ''),
      line('Run', 'AEON_CONNECT_OK'),
      line('Run', '[cursor] error: request failed'),
      line('Run', ''),
      usageLine(0, 0),
    )
    assert.equal(extractRunOutput(echoed).reply, '[cursor] error: request failed')
    assert.equal(interpretRun(facts({ harness: 'cursor', usageReported: false, log: echoed })).state, 'fail')
    // Echoed sentinel with an empty answer: still a fail.
    const empty = runLog(line('Run', 'AEON_CONNECT_OK'), line('Run', 'model said nothing'), usageLine(0, 0))
    assert.equal(interpretRun(facts({ harness: 'vibe', usageReported: false, log: empty })).state, 'fail')
    // No usage notice at all (run died before printing a result): no reply.
    assert.equal(extractRunOutput(runLog(line('Run', 'AEON_CONNECT_OK'))).reply, null)
    assert.equal(interpretRun(facts({ harness: 'kimi', usageReported: false, log: runLog(line('Run', 'AEON_CONNECT_OK')) })).state, 'fail')
    // The script block's own "AEON_CONNECT_OK" text does not count.
    const noReply = interpretRun(facts({ harness: 'cursor', usageReported: false, log: runLog(usageLine(0, 0)) }))
    assert.equal(noReply.state, 'fail')
    assert.match(noReply.reason!, /expected reply/)
    // An estimated nonzero count is not proof either.
    assert.equal(interpretRun(facts({ harness: 'kimi', usageReported: false, log: runLog(usageLine(50, 9)) })).state, 'fail')
  })

  it('maps real failure output to concrete next steps', () => {
    const cases: [string, RegExp][] = [
      [line('Run', 'Error: 401 {"type":"authentication_error"}'), /fresh key/],
      [line('Run', 'insufficient_quota: You exceeded your current quota'), /Top up/],
      [line('Run', '##[error]HTTP 429 rate limit'), /Wait a minute/],
      [line('Run', 'model_not_found: the model does not exist'), /another model/],
      [line('Resolve harness', '##[error]grok harness needs auth: set GROK_CREDENTIALS'), /saved under the right name/],
    ]
    for (const [l, hint] of cases) {
      const r = interpretRun(facts({ conclusion: 'failure', log: runLog(l) }))
      assert.equal(r.state, 'fail', l)
      assert.match(r.hint!, hint, l)
    }
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
    const c = clock()
    const final = await pollConnectCheck({ read: async () => states.shift()!, onUpdate: (r) => seen.push(r.state), cancelled: () => false, ...c })
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
    const c = clock()
    let stop = false
    await pollConnectCheck({ read: async () => { reads++; stop = true; return { state: 'running' } }, onUpdate: () => {}, cancelled: () => stop, ...c })
    assert.equal(reads, 1)
    const broken = await pollConnectCheck({ read: async () => { throw new Error('down') }, onUpdate: () => {}, cancelled: () => false, ...clock() })
    assert.equal(broken.state, 'fail')
    assert.match(broken.reason!, /Lost contact/)
  })
})
