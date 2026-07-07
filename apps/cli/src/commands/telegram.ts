import { dispatchCommandsWorkflow, ghAvailable } from '../../../dashboard/lib/gh.ts'
import { emit, c, fail, isDryRun } from '../output.ts'

const USAGE = `aeon telegram — Telegram bot integration

  aeon telegram register   Re-register the bot's / command menu (setup-commands.yml)

Options:
  --dry-run   Show what would be dispatched
  --json      Machine-readable output

Requires TELEGRAM_BOT_TOKEN to be set (see \`aeon secrets\`). The menu is also
auto-registered the moment you set that token via \`aeon secrets set\`.`

export function telegramCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : ''
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub !== 'register') fail(`unknown subcommand: ${sub || '(none)'}\n\n${USAGE}`)

  if (isDryRun()) return emit({ dryRun: true, workflow: 'setup-commands.yml' }, () =>
    console.log(c.yellow('dry-run: ') + 'gh workflow run setup-commands.yml'))

  if (!ghAvailable()) fail('GitHub CLI not authenticated. Run: gh auth login')
  try { dispatchCommandsWorkflow() } catch (e) { fail(e instanceof Error ? e.message : 'failed to dispatch') }
  emit({ ok: true }, () => console.log(c.green('✓ ') + 'dispatched setup-commands.yml — the / menu will refresh shortly'))
}
