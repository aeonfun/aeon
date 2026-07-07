import { parseArgs } from 'node:util'
import { getFileContent } from '../../../dashboard/lib/github.ts'
import { buildSoul } from '../../../dashboard/lib/builders.ts'
import { ghAvailable } from '../../../dashboard/lib/gh.ts'
import { emit, c, fail, isDryRun } from '../output.ts'

const USAGE = `aeon soul — the operator's voice (soul/SOUL.md + STYLE.md)

  aeon soul show                    Print SOUL.md and STYLE.md
  aeon soul build [--handle @x] [--name "<name>"] [--links "<url…>"] [--model <id>]
                                    Dispatch the soul-builder skill

Options:
  --dry-run   Preview the dispatch
  --json      Machine-readable output`

export async function soulCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'show'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub === 'show') return show()
  if (sub === 'build') return build(argv.slice(1))
  fail(`unknown subcommand: ${sub}\n\n${USAGE}`)
}

async function read(path: string): Promise<string> {
  try { return (await getFileContent(path)).content } catch { return '' }
}

async function show() {
  const [soul, style] = await Promise.all([read('soul/SOUL.md'), read('soul/STYLE.md')])
  emit({ soul: { content: soul, exists: !!soul }, style: { content: style, exists: !!style } }, () => {
    if (!soul && !style) { console.log(c.dim('(no soul files yet — run `aeon soul build`)')); return }
    if (soul) { console.log(c.bold('── SOUL.md ──')); console.log(soul.trimEnd()) }
    if (style) { console.log('\n' + c.bold('── STYLE.md ──')); console.log(style.trimEnd()) }
  })
}

function build(args: string[]) {
  const { values } = parseArgs({ args, options: {
    handle: { type: 'string' }, name: { type: 'string' }, links: { type: 'string' }, model: { type: 'string' },
  }, allowPositionals: true })
  const input = { handle: values.handle, name: values.name, links: values.links, model: values.model }

  let result
  try { result = buildSoul(input, { dispatch: false }) } catch (e) { return fail(e instanceof Error ? e.message : 'invalid input') }

  if (isDryRun()) return emit({ dryRun: true, sources: result.sources, command: ['gh', ...result.args] }, () =>
    console.log(c.yellow('dry-run: ') + 'gh ' + result.args.join(' ')))

  if (!ghAvailable()) fail('GitHub CLI not authenticated. Run: gh auth login')
  buildSoul(input, { dispatch: true })
  emit({ ok: true, sources: result.sources }, () => console.log(c.green('✓ ') + 'dispatched soul-builder — watch `aeon runs ls`'))
}
