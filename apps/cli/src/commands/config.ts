import { getFileContent } from '../../../dashboard/lib/github.ts'
import {
  parseConfig, updateModelInConfig, updateHarnessInConfig, updateGatewayInConfig,
} from '../../../dashboard/lib/config.ts'
import { getRepoSlug } from '../../../dashboard/lib/skills.ts'
import { HARNESSES, GATEWAY_PROVIDERS } from '../../../dashboard/lib/types.ts'
import type { Harness, GatewayProvider } from '../../../dashboard/lib/types.ts'
import { emit, c, fail } from '../output.ts'
import { applyConfig, reportConfig } from '../mutate.ts'

const USAGE = `aeon config — top-level Aeon settings in aeon.yml

  aeon config show                    Model, harness, gateway, channels, repo
  aeon config set model <id>          Set the default model
  aeon config set harness <claude|grok>
  aeon config set gateway <provider>  ${GATEWAY_PROVIDERS.join(' | ')}

Options:
  --dry-run   Preview without committing
  --json      Machine-readable output`

export async function configCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'show'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (sub === 'show') return show()
  if (sub === 'set') return set(argv.slice(1))
  fail(`unknown subcommand: ${sub}\n\n${USAGE}`)
}

async function show() {
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

async function set(args: string[]) {
  const [field, value] = args.filter(a => !a.startsWith('-'))
  if (!field || !value) fail('usage: aeon config set <model|harness|gateway> <value>')

  switch (field) {
    case 'model': {
      const res = await applyConfig(raw => updateModelInConfig(raw, value), `chore: set model to ${value}`)
      return reportConfig(res, `set model → ${value}`)
    }
    case 'harness': {
      if (!HARNESSES.includes(value as Harness)) fail(`harness must be one of: ${HARNESSES.join(', ')}`)
      const res = await applyConfig(raw => updateHarnessInConfig(raw, value as Harness), `chore: set harness to ${value}`)
      return reportConfig(res, `set harness → ${value}`)
    }
    case 'gateway': {
      if (!GATEWAY_PROVIDERS.includes(value as GatewayProvider)) fail(`gateway must be one of: ${GATEWAY_PROVIDERS.join(', ')}`)
      const res = await applyConfig(raw => updateGatewayInConfig(raw, value as GatewayProvider), `chore: set gateway to ${value}`)
      return reportConfig(res, `set gateway → ${value}`)
    }
    default:
      fail(`unknown field: ${field} (model | harness | gateway)`)
  }
}
