import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { getFileContent, saveFile } from '../../../dashboard/lib/github.ts'
import { buildStrategy } from '../../../dashboard/lib/builders.ts'
import { ghAvailable } from '../../../dashboard/lib/gh.ts'
import { emit, c, fail, isDryRun } from '../output.ts'
import { printSync } from '../mutate.ts'

const USAGE = `aeon strategy — the operator's north-star (STRATEGY.md)

  aeon strategy show                       Print STRATEGY.md
  aeon strategy set --stdin | --file <f>   Overwrite it, commit + push
  aeon strategy build "<goal>" [--repo <owner/repo>] [--links "<url…>"] [--model <id>]
                                           Dispatch the strategy-builder skill

Options:
  --dry-run   Preview a write/dispatch
  --json      Machine-readable output`

export async function strategyCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'show'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub === 'show') return show()
  if (sub === 'set') return setDoc(argv.slice(1))
  if (sub === 'build') return build(argv.slice(1))
  fail(`unknown subcommand: ${sub}\n\n${USAGE}`)
}

async function show() {
  let content = ''
  try { content = (await getFileContent('STRATEGY.md')).content } catch { fail('STRATEGY.md not found') }
  emit({ exists: true, content }, () => console.log(content.trimEnd()))
}

async function setDoc(args: string[]) {
  const { values } = parseArgs({ args, options: { file: { type: 'string' }, stdin: { type: 'boolean' } }, allowPositionals: true })
  let content: string
  if (values.stdin) content = readFileSync(0, 'utf-8')
  else if (values.file) content = readFileSync(values.file, 'utf-8')
  else return fail('usage: aeon strategy set --stdin | --file <path>')
  if (isDryRun()) return emit({ dryRun: true, bytes: content.length }, () =>
    console.log(c.yellow('dry-run: ') + `would write STRATEGY.md (${content.length} bytes) + push`))
  const sync = await saveFile('STRATEGY.md', content, { updateMsg: 'chore: update STRATEGY.md from CLI', createMsg: 'chore: add STRATEGY.md from CLI' })
  emit({ ok: true, synced: sync.synced }, () => { console.log(c.green('✓ ') + 'wrote STRATEGY.md'); printSync(sync) })
}

function build(args: string[]) {
  const { values, positionals } = parseArgs({ args, options: {
    repo: { type: 'string' }, links: { type: 'string' }, model: { type: 'string' },
  }, allowPositionals: true })
  const goal = positionals.join(' ')
  const input = { goal, repo: values.repo, links: values.links, model: values.model }

  let result
  try { result = buildStrategy(input, { dispatch: false }) } catch (e) { return fail(e instanceof Error ? e.message : 'invalid input') }

  if (isDryRun()) return emit({ dryRun: true, brief: result.brief, command: ['gh', ...result.args] }, () =>
    console.log(c.yellow('dry-run: ') + 'gh ' + result.args.join(' ')))

  if (!ghAvailable()) fail('GitHub CLI not authenticated. Run: gh auth login')
  buildStrategy(input, { dispatch: true })
  emit({ ok: true, brief: result.brief }, () => console.log(c.green('✓ ') + 'dispatched strategy-builder — watch `aeon runs ls`'))
}
