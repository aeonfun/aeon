import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

import {
  detectPaste, looksLikeCapture, parseTarEntries, classifyCapture, providersForHarness, acceptsOpenRouter,
  buildTar, CAPTURE_MAX_CHARS, CAPTURE_SPECS, MAX_MTIME, PROVIDER_OPTIONS,
} from './connect-detect'
import { captureCommand, guideFor } from './connect-commands'
import { inspectCapture, saveConnection, type SaveDeps } from './connect-server'
import { credentialsFor } from './manifest'

// Build a real tar.gz the same way the step 1 command does, rooted at a fake $HOME.
function capture(files: Record<string, string>, extra: (home: string) => void = () => {}, env: Record<string, string> = { COPYFILE_DISABLE: '1' }): string {
  const home = mkdtempSync(join(tmpdir(), 'aeon-cap-'))
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(home, rel, '..'), { recursive: true })
    writeFileSync(join(home, rel), body)
  }
  extra(home)
  const names = execFileSync('sh', ['-c', 'cd "$1" && find . -mindepth 1 \\( -type f -o -type l \\) | sed "s|^./||"', 'sh', home]).toString().trim().split('\n')
  return execFileSync('tar', ['czf', '-', '-C', home, ...names], { env: { ...process.env, ...env } }).toString('base64')
}

// Hand-built tar records, for archives no real tar would write.
function header(name: string, flag: string, size: number): Buffer {
  const h = Buffer.alloc(512)
  h.write(name, 0, 100)
  h.write('0000600\0', 100)
  h.write('0000000\0', 108)
  h.write('0000000\0', 116)
  h.write(size.toString(8).padStart(11, '0') + '\0', 124)
  h.write('00000000000\0', 136)
  h.write(flag, 156)
  h.write('ustar\0', 257)
  h.write('00', 263)
  h.fill(0x20, 148, 156)
  let sum = 0
  for (const b of h) sum += b
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  return h
}
function rawTar(records: { name: string; flag: string; body?: string }[]): string {
  const parts: Buffer[] = []
  for (const r of records) {
    const body = Buffer.from(r.body ?? '')
    parts.push(header(r.name, r.flag, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512))
  }
  parts.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(parts)).toString('base64')
}
const paxRecord = (key: string, value: string) => {
  const rest = ` ${key}=${value}\n`
  let len = rest.length + 1
  while (`${len}${rest}`.length !== len) len = `${len}${rest}`.length
  return `${len}${rest}`
}
const entryNames = (b64: string) => parseTarEntries(new Uint8Array(gunzipSync(Buffer.from(b64, 'base64')))).map((e) => e.name)

describe('detectPaste: keys by prefix (from the manifest)', () => {
  const cases: [string, string, string, string][] = [
    ['sk-ant-oat01-abc', 'claude', 'CLAUDE_CODE_OAUTH_TOKEN', 'Claude subscription'],
    ['sk-ant-oat01-abc', 'pi', 'ANTHROPIC_OAUTH_TOKEN', 'Claude subscription token'],
    ['sk-ant-api03-abc', 'claude', 'ANTHROPIC_API_KEY', 'Anthropic API key'],
    ['sk-or-v1-abc', 'codex', 'OPENROUTER_API_KEY', 'OpenRouter key'],
    ['sk-proj-abc', 'codex', 'OPENAI_API_KEY', 'OpenAI API key'],
    ['sk-abc', 'kimi', 'MOONSHOT_API_KEY', 'Moonshot API key'],
    ['xai-abc', 'grok', 'XAI_API_KEY', 'xAI API key'],
    ['bk_abc', 'claude', 'BANKR_LLM_KEY', 'Bankr key'],
    ['inf_abc', 'claude', 'SURPLUS_API_KEY', 'Surplus Intelligence key'],
    ['plainkey123', 'vibe', 'MISTRAL_API_KEY', 'Mistral API key'],
    ['plainkey123', 'cursor', 'CURSOR_API_KEY', 'Cursor API key'],
    ['plainkey123', 'fx', 'AI_GATEWAY_API_KEY', 'Vercel AI Gateway key'],
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

  it('picks the longest prefix across harnesses and warns when the harness cannot use it', () => {
    const d = detectPaste('sk-ant-api03-abc', 'codex')
    assert.equal(d.secret, 'ANTHROPIC_API_KEY')
    assert.equal(d.warn, true)
  })

  it('asks for a provider on an unprefixed key', () => {
    assert.equal(detectPaste('mysterykey', 'codex').needsProvider, true)
    assert.equal(detectPaste('mysterykey', 'codex').state, 'error')
    const claude = detectPaste('mysterykey', 'claude')
    assert.equal(claude.state, 'ok')
    assert.equal(claude.needsProvider, true)
  })

  it('honours the provider override, HivemindOS included', () => {
    assert.equal(detectPaste('mysterykey', 'claude', 'venice').secret, 'VENICE_API_KEY')
    assert.equal(detectPaste('mysterykey', 'claude', 'hivemindos').secret, 'HIVEMINDOS_CREDIT_TOKEN')
    assert.equal(detectPaste('mysterykey', 'claude', 'glm').secret, 'GLM_API_KEY')
    assert.equal(detectPaste('mysterykey', 'claude', 'nope').state, 'error')
    assert.ok(providersForHarness('claude').some((p) => p.id === 'hivemindos'))
  })

  it('rejects multiple values and treats blank as empty', () => {
    assert.equal(detectPaste('sk-ant-a sk-ant-b', 'claude').state, 'error')
    assert.equal(detectPaste('   ', 'claude').state, 'empty')
  })

  it('offers only providers the harness can run on', () => {
    assert.deepEqual(providersForHarness('vibe').map((p) => p.secret).sort(), ['MISTRAL_API_KEY', 'OPENROUTER_API_KEY'])
    assert.ok(acceptsOpenRouter('claude') && acceptsOpenRouter('hermes'))
    assert.ok(!acceptsOpenRouter('cursor') && !acceptsOpenRouter('fx') && !acceptsOpenRouter('grok'))
    assert.equal(new Set(PROVIDER_OPTIONS.map((p) => p.secret)).size, PROVIDER_OPTIONS.length)
  })
})

describe('commands come from the manifest', () => {
  it('captures exactly the manifest cred_paths and uses its login/aeon commands', () => {
    for (const spec of CAPTURE_SPECS) {
      const cred = credentialsFor(spec.harness).find((c) => c.secret === spec.secret)!
      assert.deepEqual(spec.paths, cred.cred_paths)
      assert.ok(captureCommand(spec.harness, 'mac')!.startsWith(`${cred.login_cmd} && tar -czf - -C ~ ${cred.cred_paths!.join(' ')}`))
    }
    assert.equal(captureCommand('codex', 'mac'), 'codex login && tar -czf - -C ~ .codex/auth.json | base64 | pbcopy')
    assert.equal(captureCommand('grok', 'linux'), 'grok login --device-auth && tar -czf - -C ~ .grok/auth.json | base64 -w0; echo')
    assert.match(captureCommand('kimi', 'mac')!, /\.kimi-code\/credentials \.kimi-code\/config\.toml 2>\/dev\/null \| base64/)
    assert.equal(captureCommand('claude', 'mac'), 'claude setup-token')
    assert.equal(captureCommand('pi', 'mac'), null)
    assert.equal(guideFor('codex').cli, './aeon auth --harness codex')
    assert.ok(guideFor('vibe').keys.some((k) => k.url === credentialsFor('vibe')[0].get_url))
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

  it('maps each harness login to its secret and stores a clean re-pack', () => {
    const want: [Record<string, string>, string, string][] = [
      [{ '.codex/auth.json': '{"a":1}' }, 'CODEX_AUTH', 'codex'],
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
      assert.deepEqual(entryNames(value).sort(), Object.keys(files).sort())
      // The runner's own restore (`base64 -d | tar xzf - -C $HOME`) reads it back intact.
      const home = mkdtempSync(join(tmpdir(), 'aeon-restore-'))
      execFileSync('sh', ['-c', 'printf "%s" "$1" | base64 -d | tar xzf - -C "$2"', 'sh', value, home])
      for (const [rel, body] of Object.entries(files)) assert.equal(execFileSync('cat', [join(home, rel)]).toString(), body)
    }
  })

  it('drops macOS AppleDouble sidecars and pax xattr records from the stored copy', { skip: process.platform !== 'darwin' && 'needs macOS tar + xattr' }, () => {
    const blob = capture({ '.codex/auth.json': '{}' }, (home) => {
      execFileSync('xattr', ['-w', 'com.example.test', 'hi', join(home, '.codex/auth.json')])
    }, {})
    const { detection, value } = inspectCapture(blob)
    assert.equal(detection.secret, 'CODEX_AUTH')
    assert.deepEqual(entryNames(value), ['.codex/auth.json'])
    assert.ok(!gunzipSync(Buffer.from(value, 'base64')).toString('latin1').includes('._auth.json'))
  })

  it('accepts a wrapped (GNU base64) paste', () => {
    const blob = capture({ '.codex/auth.json': '{}' })
    const { detection, value } = inspectCapture(blob.replace(/(.{76})/g, '$1\n'))
    assert.equal(detection.secret, 'CODEX_AUTH')
    assert.deepEqual(entryNames(value), ['.codex/auth.json'])
  })

  it('uses the LAST pax path, as tar does (repeated path records cannot smuggle a file)', () => {
    const pax = paxRecord('path', '.codex/auth.json') + paxRecord('path', '.evilrc')
    const evil = rawTar([{ name: 'PaxHeader/x', flag: 'x', body: pax }, { name: '.codex/auth.json', flag: '0', body: 'pwn' }])
    assert.deepEqual(entryNames(evil), ['.evilrc'])
    const r = inspectCapture(evil)
    assert.equal(r.detection.state, 'error')
    assert.equal(r.value, '')
  })

  it('refuses dangerous pax keys, global headers, links and long-name records', () => {
    for (const key of ['size', 'linkpath', 'GNU.sparse.map']) {
      const blob = rawTar([{ name: 'PaxHeader/x', flag: 'x', body: paxRecord(key, '1') }, { name: '.codex/auth.json', flag: '0', body: '{}' }])
      assert.match(inspectCapture(blob).detection.note!, new RegExp(`unsupported tar field \\(${key.replace('.', '\\.')}\\)`))
    }
    const ok = rawTar([{ name: 'PaxHeader/x', flag: 'x', body: paxRecord('mtime', '1700000000.5') + paxRecord('LIBARCHIVE.xattr.a', 'b') + paxRecord('SCHILY.xattr.c', 'd') }, { name: '.codex/auth.json', flag: '0', body: '{}' }])
    assert.equal(inspectCapture(ok).detection.secret, 'CODEX_AUTH')
    assert.match(inspectCapture(rawTar([{ name: 'g', flag: 'g', body: paxRecord('path', 'x') }, { name: '.codex/auth.json', flag: '0', body: '{}' }])).detection.note!, /global header/)
    assert.match(inspectCapture(rawTar([{ name: '.codex/auth.json', flag: '0', body: '{}' }, { name: '.codex/x', flag: '2' }])).detection.note!, /link/)
    assert.match(inspectCapture(rawTar([{ name: '././@LongLink', flag: 'L', body: '.evilrc' }, { name: '.codex/auth.json', flag: '0', body: '{}' }])).detection.note!, /long-name/)
    const linked = capture({ '.codex/auth.json': '{}' }, (home) => symlinkSync('/etc/passwd', join(home, '.codex', 'x')))
    assert.match(inspectCapture(linked).detection.note!, /link/)
  })

  it('refuses files outside the login paths, corrupt headers, and junk', () => {
    assert.equal(inspectCapture(capture({ '.codex/auth.json': '{}', '.bashrc': 'evil' })).detection.state, 'error')
    assert.equal(inspectCapture(capture({ '.codex/other.json': '{}' })).detection.state, 'error')
    assert.equal(inspectCapture(rawTar([{ name: '../.codex/auth.json', flag: '0', body: '{}' }])).detection.state, 'error')
    const bad = gunzipSync(Buffer.from(rawTar([{ name: '.codex/auth.json', flag: '0', body: '{}' }]), 'base64'))
    bad[0] = 0x2e + 1 // corrupt the name: checksum no longer matches
    assert.match(inspectCapture(gzipSync(bad).toString('base64')).detection.note!, /checksum/)
    assert.equal(inspectCapture('H4sIAAAA').detection.state, 'error')
    assert.equal(inspectCapture(gzipSync(Buffer.from('not a tar')).toString('base64')).detection.state, 'error')
    assert.equal(classifyCapture([{ name: '../x', type: 'file' }]).state, 'error')
  })

  it('keeps pax mtime finite and inside the ustar range', () => {
    const tarOf = (mtime: string) => rawTar([{ name: 'PaxHeader/x', flag: 'x', body: paxRecord('mtime', mtime) }, { name: '.codex/auth.json', flag: '0', body: '{}' }])
    const mtimeOf = (b64: string) => parseTarEntries(new Uint8Array(gunzipSync(Buffer.from(b64, 'base64'))))[0].mtime
    assert.equal(mtimeOf(tarOf('1e400')), 0) // Infinity: header value kept
    assert.equal(mtimeOf(tarOf('NaN')), 0)
    assert.equal(mtimeOf(tarOf('-5')), 0)
    assert.equal(mtimeOf(tarOf('99999999999999999')), MAX_MTIME)
    assert.equal(mtimeOf(tarOf('1700000000.9')), 1700000000)
    // The re-pack of a clamped capture still parses.
    const { detection, value } = inspectCapture(tarOf('99999999999999999'))
    assert.equal(detection.secret, 'CODEX_AUTH')
    assert.equal(entryNames(value)[0], '.codex/auth.json')
  })

  it('lets only directory entries match folder names', () => {
    // A directory entry for the login's folder is fine...
    assert.equal(inspectCapture(rawTar([{ name: '.codex/', flag: '5' }, { name: '.codex/auth.json', flag: '0', body: '{}' }])).detection.secret, 'CODEX_AUTH')
    // ...a FILE named like that folder is not (it would shadow ~/.codex).
    assert.equal(inspectCapture(rawTar([{ name: '.codex', flag: '0', body: 'x' }, { name: '.codex/auth.json', flag: '0', body: '{}' }])).detection.state, 'error')
    assert.equal(classifyCapture([{ name: '.kimi-code', type: 'file' }, { name: '.kimi-code/credentials/a.json', type: 'file' }]).state, 'error')
    // A file entry with a trailing slash is refused by the parser and the classifier.
    assert.match(inspectCapture(rawTar([{ name: '.codex/auth.json/', flag: '0', body: '{}' }])).detection.note!, /named like a folder/)
    assert.equal(classifyCapture([{ name: '.codex/auth.json/', type: 'file' }]).state, 'error')
    // Re-pack names are normalized (no ./ prefix).
    const { value } = inspectCapture(rawTar([{ name: './.codex/auth.json', flag: '0', body: '{}' }]))
    assert.deepEqual(entryNames(value), ['.codex/auth.json'])
  })

  it('buildTar round-trips through the parser', () => {
    const files = [{ name: '.grok/auth.json', data: new TextEncoder().encode('{"t":1}'), mtime: 1700000000 }]
    const back = parseTarEntries(buildTar(files))
    assert.deepEqual(back.map((e) => [e.name, e.type, e.mtime, new TextDecoder().decode(e.data)]), [['.grok/auth.json', 'file', 1700000000, '{"t":1}']])
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

  it('pins the gateway to auto for direct Claude credentials, like configureAuth', async () => {
    for (const [value, secret] of [['sk-ant-oat01-xyz', 'CLAUDE_CODE_OAUTH_TOKEN'], ['sk-ant-api03-xyz', 'ANTHROPIC_API_KEY']]) {
      const { calls, deps } = fakeDeps()
      const r = await saveConnection({ harness: 'claude', value }, deps)
      assert.equal(r.secret, secret)
      assert.deepEqual(calls, [`set:${secret}`, 'gateway'])
    }
  })

  it('leaves gateway keys to setSecret (which re-syncs them itself)', async () => {
    const { calls, deps } = fakeDeps()
    await saveConnection({ harness: 'claude', value: 'tok', provider: 'hivemindos' }, deps)
    assert.deepEqual(calls, ['set:HIVEMINDOS_CREDIT_TOKEN'])
    const other = fakeDeps()
    await saveConnection({ harness: 'codex', value: 'sk-proj-x' }, other.deps)
    assert.deepEqual(other.calls, ['set:OPENAI_API_KEY'])
  })

  it('stores a capture and switches to its harness', async () => {
    const { calls, deps } = fakeDeps()
    const r = await saveConnection({ harness: 'claude', value: capture({ '.codex/auth.json': '{}' }) }, deps)
    assert.equal(r.harness, 'codex')
    assert.deepEqual(calls, ['set:CODEX_AUTH', 'harness:codex'])
  })

  it('rejects unsavable pastes', async () => {
    const { deps } = fakeDeps()
    await assert.rejects(saveConnection({ harness: 'codex', value: 'mystery' }, deps), /provider/)
  })
})
