import { syncStatus, syncPush } from '../../../dashboard/lib/sync.ts'
import { emit, c, fail, isDryRun } from '../output.ts'

const USAGE = `aeon sync — commit + push local repo changes to GitHub

  aeon sync            Stage all changes, commit, and push to origin
  aeon sync --status   Show working-tree changes + commits behind origin/main

Options:
  --dry-run   With no --status: show what would be committed, don't push
  --json      Machine-readable output`

export function syncCommand(argv: string[]) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }

  if (argv.includes('--status')) {
    const s = syncStatus()
    return emit(s, () => {
      console.log(`${s.hasChanges ? c.yellow(`${s.changedFiles} changed file(s)`) : c.green('clean tree')}` +
        `   ${s.behind > 0 ? c.yellow(`${s.behind} behind origin/main`) : c.dim('up to date')}`)
    })
  }

  if (isDryRun()) {
    const s = syncStatus()
    return emit({ dryRun: true, ...s }, () => {
      if (!s.hasChanges) console.log(c.dim('nothing to commit'))
      else console.log(c.yellow('dry-run: ') + `would commit + push ${s.changedFiles} changed file(s)`)
    })
  }

  const result = syncPush()
  if (!result.ok) fail(result.error)
  emit(result, () => console.log(c.green('✓ ') + result.message))
}
