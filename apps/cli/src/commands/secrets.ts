import { getSecrets } from '../../../dashboard/lib/secrets-catalog.ts'
import type { Secret } from '../../../dashboard/lib/types.ts'
import { emit, table, c, fail } from '../output.ts'

const USAGE = `aeon secrets — the credential vault (names + set-state, never values)

  aeon secrets ls [--set] [--unset]    List every known secret, grouped

Options:
  --set      Only secrets that are set
  --unset    Only secrets that are missing
  --json     Machine-readable output

Setting/deleting secrets (writes) arrives in Phase 2.`

export async function secretsCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'ls'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub !== 'ls') fail(`unknown subcommand: ${sub}\n\n${USAGE}`)

  const { secrets, ghReady } = getSecrets()
  if (!ghReady) fail('GitHub CLI not authenticated — cannot read secret state. Run: gh auth login')

  const onlySet = argv.includes('--set')
  const onlyUnset = argv.includes('--unset')
  let rows = secrets
  if (onlySet) rows = rows.filter(s => s.isSet)
  if (onlyUnset) rows = rows.filter(s => !s.isSet)

  emit(rows, () => {
    if (rows.length === 0) { console.log(c.dim('(no matching secrets)')); return }
    const groups = new Map<string, Secret[]>()
    for (const s of rows) {
      const g = groups.get(s.group) ?? []
      g.push(s)
      groups.set(s.group, g)
    }
    for (const [group, items] of groups) {
      console.log(c.bold(group))
      table(
        ['', 'NAME', 'NOTE'],
        items.map(s => [
          s.isSet ? c.green('✓') : c.dim('·'),
          s.isSet ? s.name : c.dim(s.name),
          truncate(s.description, 64),
        ]),
      )
      console.log()
    }
    const set = rows.filter(s => s.isSet).length
    console.log(c.dim(`${rows.length} secrets · ${set} set`))
  })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
