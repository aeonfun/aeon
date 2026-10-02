// Side-effect module for github-push.test.ts: lib/gh reads AEON_REPO_ROOT when
// it loads, so this must be imported (and evaluated) BEFORE ./github.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const base = mkdtempSync(join(tmpdir(), 'aeon-push-'))
export const work = join(base, 'work')
process.env.AEON_REPO_ROOT = work
delete process.env.GITHUB_TOKEN
delete process.env.GITHUB_REPO
