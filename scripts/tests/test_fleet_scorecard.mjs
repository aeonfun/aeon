import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('least-reliable table contains skills only and uses their slug', async () => {
  const originalFetch = globalThis.fetch
  const originalRepo = process.env.GITHUB_REPOSITORY
  const createdAt = new Date().toISOString()
  const run = (name) => ({ name, conclusion: 'failure', created_at: createdAt, head_branch: 'main' })
  const workflowRuns = [
    run('ci-tests'), run('ci-tests'), run('ci-tests'),
    run('skill: digest'), run('skill: digest'), run('skill: digest'),
  ]

  process.env.GITHUB_REPOSITORY = 'operator/aeon'
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/actions/runs?')) {
      return new Response(JSON.stringify({ workflow_runs: workflowRuns }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.endsWith('/contents/skills')) {
      return new Response(JSON.stringify([{ type: 'dir' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('', { status: 404 })
  }

  try {
    await import(new URL(`../fleet-scorecard.mjs?test=${Date.now()}`, import.meta.url))
    const body = readFileSync('/tmp/fleet-scorecard/scorecard-body.md', 'utf8')
    assert.doesNotMatch(body, /\| ci-tests \|/, 'non-skill workflow leaked into the skill table')
    assert.match(body, /\| digest \|/, 'skill slug missing from the skill table')
    assert.doesNotMatch(body, /\| skill: digest \|/, 'workflow prefix leaked into the skill name')
  } finally {
    globalThis.fetch = originalFetch
    if (originalRepo === undefined) delete process.env.GITHUB_REPOSITORY
    else process.env.GITHUB_REPOSITORY = originalRepo
  }
})

test('prices Claude rows by model version and leaves non-Claude rows unpriced', async () => {
  const originalFetch = globalThis.fetch
  const originalRepo = process.env.GITHUB_REPOSITORY
  // 7 fields per row: date,skill,model,input,output,cache_read,cache_creation.
  // 1M input + 1M output each, so a row costs exactly (in + out) dollars, plus
  // the cache rows below.
  const csv = [
    'date,skill,model,input_tokens,output_tokens,cache_read,cache_creation',
    '2026-10-01,a,claude-opus-5-5,1000000,1000000,0,0', // 4 + 20 = 24
    '2026-10-01,a,anthropic/claude-opus-4.8,1000000,1000000,0,0', // 5 + 25 = 30
    '2026-10-01,a,claude-sonnet-5,1000000,1000000,0,0', // 2 + 10 = 12
    '2026-10-01,a,claude-sonnet-4-6,1000000,1000000,0,0', // 3 + 15 = 18
    '2026-10-01,a,claude-haiku-4-5-20251001,1000000,1000000,1000000,1000000', // 1 + 5 + read 0.1 + write 1.25 = 7.35
    '2026-10-01,b,openai/gpt-5.1-codex-mini,1000000,1000000,0,0', // unpriced
    '2026-10-01,b,codex-default,1000000,1000000,0,0', // unpriced
    '2026-10-01,b,grok-4.5,1000000,1000000,0,0', // unpriced
  ].join('\n') + '\n'

  process.env.GITHUB_REPOSITORY = 'operator/aeon'
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/actions/runs?')) {
      return new Response(JSON.stringify({ workflow_runs: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.endsWith('/contents/memory/token-usage.csv')) return new Response(csv, { status: 200 })
    return new Response('', { status: 404 })
  }

  try {
    await import(new URL(`../fleet-scorecard.mjs?test=pricing-${Date.now()}`, import.meta.url))
    const metrics = JSON.parse(readFileSync('/tmp/fleet-scorecard/metrics.json', 'utf8'))
    assert.equal(metrics.generations, 8)
    assert.equal(metrics.est_cost_usd, 24 + 30 + 12 + 18 + 7.35)
    assert.equal(metrics.unpriced_generations, 3)
    assert.equal(metrics.unpriced_tokens, 6_000_000)
    const body = readFileSync('/tmp/fleet-scorecard/scorecard-body.md', 'utf8')
    assert.match(body, /unpriced generations \(non-Claude models\) \| 3 /)
    assert.match(body, /`codex-default` \(1\)/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalRepo === undefined) delete process.env.GITHUB_REPOSITORY
    else process.env.GITHUB_REPOSITORY = originalRepo
  }
})
