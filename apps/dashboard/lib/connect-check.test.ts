import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { interpretRun, matchRun, parseUsage } from './connect-check'

// Shapes as they appear in `gh run view --log` (job, step, timestamped line).
const usageLine = (i: number, o: number, cr = 0, cc = 0) =>
  `run\tRun\t2026-10-02T10:00:00.0000000Z ##[notice]Token usage - model: claude-sonnet-5-5, input: ${i}, output: ${o}, cache_read: ${cr}, cache_creation: ${cc}, total: ${i + o}`
const okLine = 'run\tRun\t2026-10-02T10:00:00.0000000Z AEON_CONNECT_OK'
const facts = (over: Partial<Parameters<typeof interpretRun>[0]>) =>
  ({ status: 'completed', conclusion: 'success', log: '', harness: 'claude', secretsSet: [], ...over })
// The workflow's notice text uses a long dash after "Token usage".
const LONG_DASH = String.fromCharCode(0x2014)

describe('connect-check result parser', () => {
  it('reads the token usage notice (last one wins), in either log form', () => {
    assert.deepEqual(parseUsage(usageLine(12, 3, 100, 5)), { input: 12, output: 3, cacheRead: 100, cacheCreation: 5, total: 120 })
    const raw = `::notice::Token usage ${LONG_DASH} model: x, input: 7, output: 1, cache_read: 0, cache_creation: 0, total: 8`
    assert.equal(parseUsage(raw)?.total, 8)
    assert.equal(parseUsage(`${usageLine(1, 1)}\n${usageLine(0, 0)}`)?.total, 0)
    assert.equal(parseUsage('nothing here'), null)
  })

  it('passes only on success with nonzero usage', () => {
    const r = interpretRun(facts({ log: `${okLine}\n${usageLine(20, 4)}` }))
    assert.equal(r.state, 'pass')
    assert.equal(r.usage?.total, 24)
    assert.doesNotMatch(r.reason!, /expected reply/)
    assert.match(interpretRun(facts({ log: usageLine(20, 4) })).reason!, /expected reply/)
  })

  it('explains zero usage on a Claude subscription token', () => {
    const r = interpretRun(facts({ log: usageLine(0, 0), secretsSet: ['CLAUDE_CODE_OAUTH_TOKEN'] }))
    assert.equal(r.state, 'fail')
    assert.match(r.hint!, /subscription token/)
    assert.match(r.hint!, /API key or connect OpenRouter/)
  })

  it('maps failure signatures to concrete next steps', () => {
    const cases: [string, RegExp][] = [
      ['Error: 401 {"type":"authentication_error"}', /fresh key/],
      ['insufficient_quota: You exceeded your current quota', /Top up/],
      ['HTTP 429 rate limit', /Wait a minute/],
      ['model_not_found: the model does not exist', /another model/],
      ['::error::grok harness needs auth: set GROK_CREDENTIALS', /saved under the right name/],
    ]
    for (const [log, hint] of cases) {
      const r = interpretRun(facts({ conclusion: 'failure', log }))
      assert.equal(r.state, 'fail', log)
      assert.match(r.hint!, hint, log)
    }
    assert.match(interpretRun(facts({ conclusion: 'failure', log: 'boom' })).hint!, /run log/)
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
