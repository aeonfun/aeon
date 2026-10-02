/**
 * commitAndPush must push to `origin` by name (never to whatever the branch
 * tracks) and must refuse when origin is the Aeon template. Exercised against
 * real local git repos: a bare "instance" (origin), a bare "template"
 * (upstream) and a working clone whose main still tracks upstream - the state
 * an interrupted template switch-over can leave.
 */
import { describe, it, before, after } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// Must stay above ./github: it pins AEON_REPO_ROOT before lib/gh loads.
import { base, work } from './github-push.fixture'
import { commitAndPush, isTemplateRemote } from './github'

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

describe('isTemplateRemote', () => {
  it('matches the template and its redirect, in any URL form', () => {
    assert.equal(isTemplateRemote('https://github.com/aeonfun/aeon.git'), true)
    assert.equal(isTemplateRemote('git@github.com:aeonfun/aeon.git'), true)
    assert.equal(isTemplateRemote('https://github.com/AaronJMars/aeon'), true)
    assert.equal(isTemplateRemote('https://github.com/someone/aeon.git'), false)
    assert.equal(isTemplateRemote('https://github.com/aeonfun/aeon-website.git'), false)
  })
})

describe('commitAndPush', () => {
  it('pushes to origin even when the branch tracks another remote', () => {
    writeFileSync(join(work, 'aeon.yml'), 'model: b\n')
    const res = commitAndPush(['aeon.yml'], 'chore: b')
    assert.deepEqual(res, { synced: true })
    const head = git(work, 'rev-parse', 'HEAD')
    assert.equal(git(base, '--git-dir=instance.git', 'rev-parse', 'main'), head)
    assert.notEqual(git(base, '--git-dir=template.git', 'rev-parse', 'main'), head)
  })

  it('refuses to commit or push when origin is the template', () => {
    git(work, 'remote', 'set-url', 'origin', 'https://github.com/aeonfun/aeon.git')
    const before = git(work, 'rev-parse', 'HEAD')
    writeFileSync(join(work, 'aeon.yml'), 'model: c\n')
    const res = commitAndPush(['aeon.yml'], 'chore: c')
    assert.equal(res.synced, false)
    assert.match(res.reason ?? '', /template/)
    assert.equal(git(work, 'rev-parse', 'HEAD'), before)
    git(work, 'remote', 'set-url', 'origin', join(base, 'instance.git'))
  })
})
