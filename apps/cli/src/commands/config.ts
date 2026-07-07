import { getFileContent } from '../../../dashboard/lib/github.ts'
import { parseConfig } from '../../../dashboard/lib/config.ts'
import { getRepoSlug } from '../../../dashboard/lib/skills.ts'
import { emit, c, fail } from '../output.ts'

const USAGE = `aeon config — top-level Aeon settings from aeon.yml

  aeon config show     Model, harness, gateway, channels, repo

Options:
  --json     Machine-readable output

Setting config (model/harness/gateway) arrives in Phase 2.`

export async function configCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'show'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub !== 'show') fail(`unknown subcommand: ${sub}\n\n${USAGE}`)

  let raw: string
  try {
    raw = (await getFileContent('aeon.yml')).content
  } catch (e) {
    fail(e instanceof Error ? e.message : 'could not read aeon.yml')
  }
  const cfg = parseConfig(raw)
  const enabled = Object.values(cfg.skills).filter(s => s.enabled).length
  const repo = getRepoSlug()

  const data = {
    repo: repo || null,
    model: cfg.model,
    harness: cfg.harness,
    gateway: cfg.gateway.provider,
    jsonrenderEnabled: cfg.jsonrenderEnabled,
    skillsEnabled: enabled,
    skillsConfigured: Object.keys(cfg.skills).length,
  }

  emit(data, () => {
    const line = (k: string, v: string) => console.log(c.dim(k.padEnd(14)) + v)
    line('repo', repo || c.dim('(unresolved)'))
    line('model', cfg.model)
    line('harness', cfg.harness)
    line('gateway', cfg.gateway.provider)
    line('json-render', cfg.jsonrenderEnabled ? c.green('on') : c.dim('off'))
    line('skills', `${c.green(String(enabled))} enabled / ${Object.keys(cfg.skills).length} configured`)
  })
}
