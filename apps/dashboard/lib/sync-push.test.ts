/**
 * syncPush (`aeon sync`, POST /api/sync) must push like commitAndPush: to
 * `origin` by name (never whatever the branch tracks), and refuse, without
 * committing, when origin is the Aeon template. Same real-git fixture shape as
 * github-push.test.ts: a bare "instance" (origin), a bare "template"
 * (upstream) and a working clone whose main still tracks upstream.
 */
import { describe, it, before, after } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// Must stay above ./sync: it pins AEON_REPO_ROOT before lib/gh loads.
import { base, work } from './github-push.fixture'
import { syncPush } from './sync'

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).toString().trim()

before(() => {
  for (const r of ['instance.git', 'template.git']) git(base, 'init', '-q', '--bare', '-b', 'main', r)
  git(base, 'init', '-q', '-b', 'main', 'work')
  git(work, 'config', 'user.email', 'test@example.com')
  git(work, 'config', 'user.name', 'test')
  git(work, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(work, 'aeon.yml'), 'model: a\n')
  git(work, 'add', 'aeon.yml')
  git(work, 'commit', '-q', '-m', 'init')
  git(work, 'remote', 'add', 'origin', join(base, 'instance.git'))
  git(work, 'remote', 'add', 'upstream', join(base, 'template.git'))
  git(work, 'push', '-q', 'origin', 'main')
  git(work, 'push', '-q', 'upstream', 'main')
  // main tracks the TEMPLATE remote, as after an interrupted switch-over.
  git(work, 'branch', '--set-upstream-to=upstream/main', 'main')
})

after(() => rmSync(base, { recursive: true, force: true }))

describe('syncPush', () => {
  it('pushes to origin even when the branch tracks the template', () => {
    writeFileSync(join(work, 'aeon.yml'), 'model: b\n')
    const res = syncPush()
    assert.deepEqual(res, { ok: true, message: 'Pushed to GitHub' })
    const head = git(work, 'rev-parse', 'HEAD')
    assert.equal(git(base, '--git-dir=instance.git', 'rev-parse', 'main'), head)
    assert.notEqual(git(base, '--git-dir=template.git', 'rev-parse', 'main'), head)
  })

  it('rebases onto origin and retries when origin moved ahead', () => {
    // Someone else (an Actions bot) pushed to the instance meanwhile.
    git(base, 'clone', '-q', 'instance.git', 'other')
    const other = join(base, 'other')
    git(other, 'config', 'user.email', 'bot@example.com')
    git(other, 'config', 'user.name', 'bot')
    writeFileSync(join(other, 'memory.md'), 'log\n')
    git(other, 'add', 'memory.md')
    git(other, 'commit', '-q', '-m', 'bot')
    git(other, 'push', '-q', 'origin', 'main')
    writeFileSync(join(work, 'aeon.yml'), 'model: c\n')
    assert.equal(syncPush().ok, true)
    assert.equal(git(base, '--git-dir=instance.git', 'rev-parse', 'main'), git(work, 'rev-parse', 'HEAD'))
    assert.equal(git(base, '--git-dir=instance.git', 'log', '-1', '--format=%s', 'main~1'), 'bot')
  })

  it('refuses without committing when origin is the template', () => {
    git(work, 'remote', 'set-url', 'origin', 'https://github.com/aeonfun/aeon.git')
    const before = git(work, 'rev-parse', 'HEAD')
    writeFileSync(join(work, 'aeon.yml'), 'model: d\n')
    const res = syncPush()
    assert.equal(res.ok, false)
    assert.match(res.ok ? '' : res.error, /template/)
    assert.equal(git(work, 'rev-parse', 'HEAD'), before)
    assert.notEqual(git(work, 'status', '--porcelain'), '')
    git(work, 'remote', 'set-url', 'origin', join(base, 'instance.git'))
  })

  it('refuses when there is no origin remote at all', () => {
    git(work, 'remote', 'remove', 'origin')
    const res = syncPush()
    assert.equal(res.ok, false)
    assert.match(res.ok ? '' : res.error, /no origin remote/)
  })
})
