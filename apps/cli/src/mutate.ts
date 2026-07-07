import { getFileContent, saveFile } from '../../dashboard/lib/github.ts'
import type { CommitResult } from '../../dashboard/lib/github.ts'
import { emit, c, isDryRun } from './output.ts'

export interface ConfigChange {
  changed: boolean
  dryRun: boolean
  sync?: CommitResult
  before: string
  after: string
}

// Read aeon.yml, apply a config mutator (from the shared lib), and — unless
// --dry-run — save + commit + push it, exactly the way the dashboard's edits do.
// The mutators (updateSkillInConfig etc.) are the shared logic; this is only the
// read/save glue.
export async function applyConfig(mutate: (raw: string) => string, message: string): Promise<ConfigChange> {
  const { content } = await getFileContent('aeon.yml')
  const after = mutate(content)
  const changed = after !== content
  if (!changed || isDryRun()) return { changed, dryRun: isDryRun(), before: content, after }
  const sync = await saveFile('aeon.yml', after, { updateMsg: message, createMsg: message })
  return { changed, dryRun: false, sync, before: content, after }
}

// Human/JSON report for a config change. `label` names what happened, e.g.
// "enabled heartbeat".
export function reportConfig(res: ConfigChange, label: string) {
  emit({ label, changed: res.changed, dryRun: res.dryRun, ...(res.sync ? { synced: res.sync.synced, syncError: res.sync.reason } : {}) }, () => {
    if (!res.changed) { console.log(c.dim(`no change — ${label} already in that state`)); return }
    if (res.dryRun) {
      console.log(c.yellow('dry-run: ') + `would ${label}`)
      printDiff(res.before, res.after)
      return
    }
    console.log(c.green('✓ ') + label)
    printSync(res.sync)
  })
}

// Compact preview of which aeon.yml lines changed. Localized yaml edits touch a
// line or two, so a naive add/remove set is enough — no full LCS needed.
export function printDiff(before: string, after: string) {
  const b = before.split('\n'), a = after.split('\n')
  const bs = new Set(b), as = new Set(a)
  const removed = b.filter(l => !as.has(l) && l.trim())
  const added = a.filter(l => !bs.has(l) && l.trim())
  for (const l of removed) console.log(c.red('  - ' + l.trim()))
  for (const l of added) console.log(c.green('  + ' + l.trim()))
}

// Report the commit/push outcome of a write. saveFile pushes to origin main in
// local mode (how scheduled runs pick up config), so surface push failures.
export function printSync(sync?: CommitResult) {
  if (!sync) return
  if (sync.synced) console.log(c.dim('  pushed to origin'))
  else console.log(c.yellow('  saved locally but not pushed: ') + (sync.reason || 'unknown'))
}
