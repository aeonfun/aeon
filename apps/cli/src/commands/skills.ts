import { parseArgs } from 'node:util'
import { getSkills } from '../../../dashboard/lib/skills.ts'
import type { Skill } from '../../../dashboard/lib/types.ts'
import { emit, table, c, fail } from '../output.ts'

const USAGE = `aeon skills — inspect the skill roster

  aeon skills ls [--enabled] [--pack <key>]   List skills with their live config
  aeon skills <name>                          Show one skill's detail

Options:
  --enabled        Only skills currently enabled in aeon.yml
  --pack <key>     Only skills in the given pack (e.g. core, evolution, dev)
  --json           Machine-readable output

Mutating commands (enable/disable/schedule/set/rm/run) arrive in Phase 2.`

export async function skillsCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'ls'
  const rest = sub === argv[0] ? argv.slice(1) : argv

  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) {
    console.log(USAGE); return
  }

  const data = await getSkills()

  if (sub === 'ls') return listSkills(data.skills, rest)
  // Any other bare token is treated as a skill name to show detail for.
  return showSkill(data.skills, sub)
}

function listSkills(skills: Skill[], args: string[]) {
  let opts: { values: { enabled?: boolean; pack?: string } }
  try {
    opts = parseArgs({ args, options: {
      enabled: { type: 'boolean' },
      pack: { type: 'string' },
    }, allowPositionals: false })
  } catch (e) {
    fail(e instanceof Error ? e.message : 'bad arguments')
  }

  let rows = skills
  if (opts.values.enabled) rows = rows.filter(s => s.enabled)
  if (opts.values.pack) rows = rows.filter(s => s.pack === opts.values.pack)
  rows = [...rows].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))

  emit(rows, () => {
    if (rows.length === 0) { console.log(c.dim('(no matching skills)')); return }
    table(
      ['SKILL', 'ON', 'SCHEDULE', 'PACK', 'DESCRIPTION'],
      rows.map(s => [
        s.name,
        s.enabled ? c.green('●') : c.dim('○'),
        s.enabled ? s.schedule : c.dim(s.schedule),
        s.pack,
        truncate(s.description, 60),
      ]),
    )
    const on = rows.filter(s => s.enabled).length
    console.log(c.dim(`\n${rows.length} skills · ${on} enabled`))
  })
}

function showSkill(skills: Skill[], name: string) {
  const s = skills.find(x => x.name === name)
  if (!s) fail(`no such skill: ${name}`)
  emit(s, () => {
    console.log(c.bold(s.name) + '  ' + (s.enabled ? c.green('enabled') : c.dim('disabled')))
    console.log(s.description)
    console.log()
    const rows: [string, string][] = [
      ['pack', `${s.pack}${s.packName ? ` (${s.packName})` : ''}`],
      ['category', s.category],
      ['schedule', s.schedule],
      ['var', s.var || c.dim('—')],
      ['model', s.model || c.dim('(inherit)')],
      ['harness', s.harness || c.dim('(inherit)')],
      ['requires', s.requires.map(r => r.key + (r.optional ? '?' : '')).join(', ') || c.dim('—')],
      ['mcp', s.mcp.map(m => m.slug + (m.optional ? '?' : '')).join(', ') || c.dim('—')],
    ]
    for (const [k, v] of rows) console.log(c.dim(k.padEnd(10)) + v)
  })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
