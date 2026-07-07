import { parseArgs } from 'node:util'
import { configureAuth } from '../../../dashboard/lib/auth.ts'
import { normalizeAuthConfig } from '../../../dashboard/lib/auth-provider.ts'
import { ghAvailable } from '../../../dashboard/lib/gh.ts'
import { emit, c, fail, isDryRun } from '../output.ts'

const USAGE = `aeon auth — set how Claude Code authenticates in CI

  aeon auth --oauth                 Mint a Claude OAuth token via \`claude setup-token\`
  aeon auth --key <sk-ant-…|bk_…|…>  Set an Anthropic / gateway key (provider auto-detected)
  aeon auth <token>                 Same as --key (positional)

Options:
  --provider <slug>   Force a gateway (bankr, openrouter, venice, …)
  --base-url <url>    Custom HTTPS base URL (API-key auth only)
  --dry-run           Show what would be set, without calling gh/claude
  --json              Machine-readable output`

export async function authCommand(argv: string[]) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  if (!ghAvailable()) fail('GitHub CLI not authenticated. Run: gh auth login')

  let values: { key?: string; provider?: string; 'base-url'?: string; oauth?: boolean }
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({ args: argv, options: {
      key: { type: 'string' }, provider: { type: 'string' },
      'base-url': { type: 'string' }, oauth: { type: 'boolean' },
    }, allowPositionals: true }))
  } catch (e) { fail(e instanceof Error ? e.message : 'bad arguments') }

  const key = values.oauth ? '' : (values.key ?? positionals[0] ?? '')
  const body = { key, provider: values.provider, baseUrl: values['base-url'] }

  if (isDryRun()) {
    // normalizeAuthConfig is pure — it tells us the resolved method/secret without
    // touching gh or claude.
    let plan
    try { plan = normalizeAuthConfig(body) } catch (e) { fail(e instanceof Error ? e.message : 'invalid auth config') }
    return emit({ dryRun: true, ...plan, key: undefined }, () =>
      console.log(c.yellow('dry-run: ') + `method=${plan.method} → secret ${plan.secretName}` +
        (plan.baseUrl ? ` + ANTHROPIC_BASE_URL=${plan.baseUrl}` : '') +
        (plan.method === 'oauth' && !key ? ' (would run `claude setup-token`)' : '')))
  }

  let result
  try {
    result = await configureAuth(body)
  } catch (e) {
    fail(e instanceof Error ? e.message : 'failed to configure auth')
  }
  emit(result, () => console.log(c.green('✓ ') + `authenticated (method: ${result.method}` +
    (result.secret ? `, secret: ${result.secret}` : '') + ')'))
}
