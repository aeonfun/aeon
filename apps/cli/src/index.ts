// Aeon CLI — non-interactive control of an Aeon repo. Reuses apps/dashboard/lib
// so every command returns exactly what the dashboard's /api/* routes do.
//
// Phase 1 (this file) ships the read-only surface: skills, runs, secrets, config,
// memory. Mutating commands (enable/disable/schedule/run, secret set, auth, sync)
// land in Phase 2 on the same shared lib.
import { setJsonMode, c, fail } from './output.ts'
import { skillsCommand } from './commands/skills.ts'
import { runsCommand } from './commands/runs.ts'
import { secretsCommand } from './commands/secrets.ts'
import { configCommand } from './commands/config.ts'
import { memoryCommand } from './commands/memory.ts'

const USAGE = `${c.bold('aeon')} — command-line control of this Aeon repo

Usage: aeon <command> [subcommand] [options]

Commands (read-only, Phase 1):
  skills     List the skill roster with live enabled/schedule state
  runs       List recent workflow runs, or read one run's log + summary
  secrets    List the credential vault (names + set-state, never values)
  config     Show top-level settings (model, harness, gateway) from aeon.yml
  memory     Browse the agent's persistent memory (logs, topics, issues, search)

Global options:
  --json     Emit machine-readable JSON instead of a table
  -h, --help Show help (works per-command too, e.g. \`aeon runs --help\`)

Coming next:
  Phase 2  skills enable/disable/schedule/set/rm/run · secrets set/rm · auth · sync
  Phase 3  strategy · soul · packs · mcp · telegram`

const COMMANDS: Record<string, (argv: string[]) => void | Promise<void>> = {
  skills: skillsCommand,
  runs: runsCommand,
  secrets: secretsCommand,
  config: configCommand,
  memory: memoryCommand,
}

async function main() {
  // Pull the global --json flag out of argv wherever it appears, so commands
  // only see their own args.
  const raw = process.argv.slice(2)
  const argv = raw.filter(a => a !== '--json')
  if (raw.length !== argv.length) setJsonMode(true)

  const cmd = argv[0]
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(USAGE)
    return
  }

  const handler = COMMANDS[cmd]
  if (!handler) {
    fail(`unknown command: ${cmd}\n\nRun \`aeon --help\` for the command list.`)
  }

  await handler(argv.slice(1))
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  // Surface the gh/git failures the shared lib throws as clean CLI errors.
  fail(msg)
})
