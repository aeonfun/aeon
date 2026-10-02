import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

import { detectPaste, looksLikeCapture, parseTarEntries, classifyCapture, providersForHarness, acceptsOpenRouter, CAPTURE_MAX_CHARS } from './connect-detect'
import { captureCommand } from './connect-commands'
import { inspectCapture, saveConnection, type SaveDeps } from './connect-server'

// Build a real tar.gz the same way the step 1 command does, rooted at a fake $HOME.
function capture(files: Record<string, string>, extra: (home: string) => void = () => {}): string {
  const home = mkdtempSync(join(tmpdir(), 'aeon-cap-'))
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(home, rel, '..'), { recursive: true })
    writeFileSync(join(home, rel), body)
  }
  extra(home)
  const names = execFileSync('sh', ['-c', 'cd "$1" && find . -mindepth 1 \\( -type f -o -type l \\) | sed "s|^./||"', 'sh', home]).toString().trim().split('\n')
  return execFileSync('tar', ['czf', '-', '-C', home, ...names], { env: { ...process.env, COPYFILE_DISABLE: '1' } }).toString('base64')
}

describe('detectPaste: keys by prefix', () => {
  const cases: [string, string, string, string][] = [
    ['sk-ant-oat01-abc', 'claude', 'CLAUDE_CODE_OAUTH_TOKEN', 'Claude subscription token'],
    ['sk-ant-oat01-abc', 'pi', 'ANTHROPIC_OAUTH_TOKEN', 'Claude subscription token'],
    ['sk-ant-api03-abc', 'claude', 'ANTHROPIC_API_KEY', 'Anthropic API key'],
    ['sk-or-v1-abc', 'codex', 'OPENROUTER_API_KEY', 'OpenRouter key'],
    ['sk-proj-abc', 'codex', 'OPENAI_API_KEY', 'OpenAI API key'],
    ['sk-abc', 'kimi', 'MOONSHOT_API_KEY', 'Moonshot API key'],
    ['xai-abc', 'grok', 'XAI_API_KEY', 'xAI API key'],
    ['bk_abc', 'claude', 'BANKR_LLM_KEY', 'Bankr key'],
    ['inf_abc', 'claude', 'SURPLUS_API_KEY', 'Surplus Intelligence key'],
    ['plainkey123', 'vibe', 'MISTRAL_API_KEY', 'Mistral key'],
    ['plainkey123', 'cursor', 'CURSOR_API_KEY', 'Cursor key'],
  ]
  for (const [key, harness, secret, label] of cases) {
    it(`${key} on ${harness} -> ${secret}`, () => {
      const d = detectPaste(`  ${key}\n`, harness)
      assert.equal(d.state, 'ok')
      assert.equal(d.secret, secret)
      assert.equal(d.label, label)
      assert.ok(!d.warn)
    })
  }

  it('warns when the harness cannot use the key', () => {
    const d = detectPaste('sk-ant-api03-abc', 'codex')
    assert.equal(d.state, 'ok')
    assert.equal(d.warn, true)
  })

  it('asks for a provider on an unprefixed key', () => {
    assert.equal(detectPaste('mysterykey', 'codex').needsProvider, true)
    assert.equal(detectPaste('mysterykey', 'codex').state, 'error')
    const claude = detectPaste('mysterykey', 'claude')
    assert.equal(claude.state, 'ok')
    assert.equal(claude.needsProvider, true)
  })

  it('honours the provider override', () => {
    assert.equal(detectPaste('mysterykey', 'claude', 'venice').secret, 'VENICE_API_KEY')
    assert.equal(detectPaste('mysterykey', 'claude', 'hivemindos').secret, 'HIVEMINDOS_CREDIT_TOKEN')
    assert.equal(detectPaste('mysterykey', 'claude', 'nope').state, 'error')
  })

  it('rejects multiple values and treats blank as empty', () => {
    assert.equal(detectPaste('sk-ant-a sk-ant-b', 'claude').state, 'error')
    assert.equal(detectPaste('   ', 'claude').state, 'empty')
  })

  it('offers only providers the harness can run on', () => {
    assert.deepEqual(providersForHarness('vibe').map((p) => p.id), ['openrouter', 'mistral'])
    assert.ok(providersForHarness('claude').some((p) => p.id === 'glm'))
    assert.ok(acceptsOpenRouter('claude') && acceptsOpenRouter('hermes'))
    assert.ok(!acceptsOpenRouter('cursor') && !acceptsOpenRouter('fx') && !acceptsOpenRouter('grok'))
  })
})

describe('login captures', () => {
  it('flags a base64 gzip blob as pending and enforces the 48 KB cap', () => {
    const blob = capture({ '.codex/auth.json': '{}' })
    assert.ok(looksLikeCapture(blob))
    assert.equal(detectPaste(blob, 'claude').state, 'pending')
    const huge = `H4sI${'A'.repeat(CAPTURE_MAX_CHARS)}`
    assert.equal(detectPaste(huge, 'codex').state, 'error')
    assert.match(detectPaste(huge, 'codex').note!, /48 KB/)
  })

  it('maps each harness login to its secret', () => {
    const want: [Record<string, string>, string, string][] = [
      [{ '.codex/auth.json': '{}' }, 'CODEX_AUTH', 'codex'],
      [{ '.kimi-code/credentials/kimi-code.json': '{}', '.kimi-code/config.toml': 'x=1' }, 'KIMI_AUTH', 'kimi'],
      [{ '.hermes/auth.json': '{}', '.hermes/config.yaml': 'a: 1' }, 'HERMES_AUTH', 'hermes'],
      [{ '.grok/auth.json': '{}' }, 'GROK_CREDENTIALS', 'grok'],
    ]
    for (const [files, secret, harness] of want) {
      const { detection, value } = inspectCapture(capture(files))
      assert.equal(detection.state, 'ok', JSON.stringify(detection))
      assert.equal(detection.secret, secret)
      assert.equal(detection.captureHarness, harness)
      assert.ok(!/\s/.test(value))
    }
  })

  it('accepts a wrapped (GNU base64) paste and normalizes it to one line', () => {
    const blob = capture({ '.codex/auth.json': '{}' })
    const wrapped = blob.replace(/(.{76})/g, '$1\n')
    const { detection, value } = inspectCapture(wrapped)
    assert.equal(detection.secret, 'CODEX_AUTH')
    assert.equal(value, blob)
  })

  it('refuses archives with files outside the login paths, links, or junk', () => {
    assert.equal(inspectCapture(capture({ '.codex/auth.json': '{}', '.bashrc': 'evil' })).detection.state, 'error')
    assert.equal(inspectCapture(capture({ '.codex/other.json': '{}' })).detection.state, 'error')
    const linked = capture({ '.codex/auth.json': '{}' }, (home) => symlinkSync('/etc/passwd', join(home, '.codex', 'x')))
    assert.match(inspectCapture(linked).detection.note!, /link/)
    assert.equal(inspectCapture('H4sIAAAA').detection.state, 'error')
    assert.equal(inspectCapture(gzipSync(Buffer.from('not a tar')).toString('base64')).detection.state, 'error')
  })

  it('parses ustar names and stops at the end marker', () => {
    const blob = capture({ '.grok/auth.json': '{}' })
    const tar = gunzipSync(Buffer.from(blob, 'base64'))
    const names = parseTarEntries(new Uint8Array(tar)).map((e) => e.name)
    assert.deepEqual(names, ['.grok/auth.json'])
    assert.equal(classifyCapture([{ name: '../x', type: 'file' }]).state, 'error')
  })

  it('step 1 commands produce exactly what the runner restores', () => {
    assert.equal(captureCommand('codex', 'mac'), 'codex login && tar -czf - -C ~ .codex/auth.json | base64 | pbcopy')
    assert.equal(captureCommand('grok', 'linux'), 'grok login --device-auth && tar -czf - -C ~ .grok/auth.json | base64 -w0; echo')
    assert.match(captureCommand('kimi', 'mac')!, /\.kimi-code\/credentials \.kimi-code\/config\.toml 2>\/dev\/null \| base64/)
    assert.equal(captureCommand('claude', 'mac'), 'claude setup-token')
    assert.equal(captureCommand('pi', 'mac'), null)
  })
})

describe('saveConnection', () => {
  const fakeDeps = () => {
    const calls: string[] = []
    const deps: SaveDeps = {
      setSecret: async (n) => { calls.push(`set:${n}`) },
      syncHarness: async (h) => { calls.push(`harness:${h}`); return { synced: true } },
      syncGateway: async () => { calls.push('gateway') },
    }
    return { calls, deps }
  }

  it('stores a key under the detected secret without switching harness', async () => {
    const { calls, deps } = fakeDeps()
    const r = await saveConnection({ harness: 'claude', value: 'sk-ant-oat01-xyz' }, deps)
    assert.equal(r.secret, 'CLAUDE_CODE_OAUTH_TOKEN')
    assert.deepEqual(calls, ['set:CLAUDE_CODE_OAUTH_TOKEN'])
  })

  it('stores a capture and switches to its harness', async () => {
    const { calls, deps } = fakeDeps()
    const r = await saveConnection({ harness: 'claude', value: capture({ '.codex/auth.json': '{}' }) }, deps)
    assert.equal(r.harness, 'codex')
    assert.deepEqual(calls, ['set:CODEX_AUTH', 'harness:codex'])
  })

  it('syncs the gateway for HivemindOS and rejects unsavable pastes', async () => {
    const { calls, deps } = fakeDeps()
    await saveConnection({ harness: 'claude', value: 'tok', provider: 'hivemindos' }, deps)
    assert.deepEqual(calls, ['set:HIVEMINDOS_CREDIT_TOKEN', 'gateway'])
    await assert.rejects(saveConnection({ harness: 'codex', value: 'mystery' }, deps), /provider/)
  })
})
