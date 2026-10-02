import { parseArgs } from 'node:util'
import { configureAuth } from '../../../dashboard/lib/auth.ts'
import { normalizeAuthConfig } from '../../../dashboard/lib/auth-provider.ts'
import { captureGithubToken } from '../../../dashboard/lib/github-auth.ts'
import { HARNESS_AUTH } from '../../../dashboard/lib/harness-auth.ts'
import { driveTtyLogin, captureHarnessCreds, setHarnessApiKey } from '../../../dashboard/lib/harness-auth-server.ts'
import { grokLogin, storeGrokKey } from '../grok.ts'
import { emit, c, fail, isDryRun, requireGh, requireInstanceRepo } from '../output.ts'

const USAGE = `aeon auth — set how the agent authenticates in CI

Claude harness (default):
  aeon auth --harness claude-code   Mint a Claude OAuth token via \`claude setup-token\` (alias: --oauth)
  aeon auth --key <sk-ant-…|bk_…|…>  Set an Anthropic / gateway key (provider auto-detected)
  aeon auth <token>                 Same as --key (positional)
  aeon auth --github                Copy this machine's gh token into GH_GLOBAL
                                    (needs the repo + workflow scopes:
                                    gh auth refresh -h github.com -s repo,workflow)

Other harnesses (--harness grok|codex|kimi|pi|vibe|fx|cursor|hermes):
  aeon auth --harness grok          Log in with your X account, store as GROK_CREDENTIALS
  aeon auth --harness grok --key <xai-…>          Store an xAI API key instead
  aeon auth --harness codex         Log in with ChatGPT (browser), store as CODEX_AUTH
  aeon auth --harness kimi          Log in with Moonshot (device code), store as KIMI_AUTH
  aeon auth --harness codex --key <sk-…>          Store an OpenAI key instead of the ChatGPT login
  aeon auth --harness pi   --key <sk-ant-…|sk-…>  Native provider key for pi
  aeon auth --harness vibe --key <key>            Mistral key for vibe
  aeon auth --harness fx --key <key>              Vercel AI Gateway key for fx
  aeon auth --harness cursor --key <key>          Cursor API key
  aeon auth --harness hermes        Log in with Nous Portal, store as HERMES_AUTH
  (codex, kimi, pi, vibe and hermes also run on the shared OPENROUTER_API_KEY - set that in Settings.)

Options:
  --harness <h>       claude-code | grok | codex | kimi | pi | vibe | fx | cursor | hermes (omit for claude-code)
  --github            Copy \`gh auth token\` into GH_GLOBAL
  --provider <slug>   Force a gateway (bankr, openrouter, venice, …) — Claude only
  --base-url <url>    Custom HTTPS base URL (API-key auth only) — Claude only
  --dry-run           Show what would be set, without calling gh/the CLI
  --json              Machine-readable output`

const CLAUDE_HARNESS = new Set(['claude-code', 'claude'])

export async function authCommand(argv: string[]) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  requireGh()
  if (!isDryRun()) requireInstanceRepo()

  let values: { key?: string; provider?: string; 'base-url'?: string; oauth?: boolean; harness?: string; github?: boolean }
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({ args: argv, options: {
      key: { type: 'string' }, provider: { type: 'string' },
      'base-url': { type: 'string' }, oauth: { type: 'boolean' },
      harness: { type: 'string' }, github: { type: 'boolean' },
    }, allowPositionals: true }))
  } catch (e) { fail(e instanceof Error ? e.message : 'bad arguments') }

  if (values.github) {
    if (isDryRun()) return emit({ dryRun: true, method: 'oauth', secret: 'GH_GLOBAL' }, () =>
      console.log(c.yellow('dry-run: ') + 'would copy `gh auth token` -> secret GH_GLOBAL'))
    let result
    try { result = captureGithubToken() }
    catch (e) { fail(e instanceof Error ? e.message : 'failed to copy GitHub token') }
    return emit(result, () => console.log(c.green('✓ ') + `GitHub: copied gh token as ${result.secret}`))
  }
  // --- grok: X-account OAuth capture or an xAI key (not in HARNESS_AUTH) ---
  if (values.harness === 'grok') {
    const key = (values.key ?? positionals[0] ?? '').trim()
    if (isDryRun()) return emit({ dryRun: true, harness: 'grok', method: key ? 'api-key' : 'oauth', secret: key ? 'XAI_API_KEY' : 'GROK_CREDENTIALS' }, () =>
      console.log(c.yellow('dry-run: ') + (key ? 'grok key -> secret XAI_API_KEY' : 'would run `grok login --device-auth` -> secret GROK_CREDENTIALS')))
    let res: { secret: string }
    try { res = key ? await storeGrokKey(key) : grokLogin() } catch (e) { fail(e instanceof Error ? e.message : 'grok auth failed') }
    return emit({ ok: true, harness: 'grok', method: key ? 'api-key' : 'oauth', secret: res.secret }, () =>
      console.log(c.green('✓ ') + `grok: stored as ${res.secret}. Select the harness with \`aeon config set harness grok\`.` +
        (key ? '' : '\n  The X login rotates its refresh token; set GH_GLOBAL (aeon auth --github) so each run can save the new one.')))
  }

  // --- Non-Claude harnesses: native OAuth capture or a provider key ---
  // `--harness claude-code` (or `claude`) falls through to the Claude path below.
  if (values.harness && !CLAUDE_HARNESS.has(values.harness)) {
    const harness = values.harness
    const spec = HARNESS_AUTH[harness]
    if (!spec) fail(`unknown harness '${harness}'. Native auth is available for: claude-code, ${Object.keys(HARNESS_AUTH).join(', ')}`)
    const key = (values.key ?? positionals[0] ?? '').trim()

    // A key was given (or the harness only supports keys) → store it.
    if (key || !spec.oauth) {
      if (!spec.apiKey) fail(`${harness} has no API-key path — run \`aeon auth --harness ${harness}\` for its login flow`)
      if (!key) fail(`${harness} takes a provider API key: aeon auth --harness ${harness} --key <…>`)
      const target = spec.apiKey.detect ? spec.apiKey.detect(key) : spec.apiKey.secret
      if (isDryRun()) return emit({ dryRun: true, harness, method: 'api-key', secret: target }, () =>
        console.log(c.yellow('dry-run: ') + `${harness} key → secret ${target}`))
      let res: { secret: string }
      try { res = setHarnessApiKey(harness, key) } catch (e) { fail(e instanceof Error ? e.message : 'failed to set key') }
      return emit({ ok: true, harness, method: 'api-key', secret: res.secret }, () =>
        console.log(c.green('✓ ') + `${harness}: key stored as ${res.secret}. Select the harness with \`aeon config set harness ${harness}\`.`))
    }

    // No key → drive the native OAuth login, then capture the credential.
    if (isDryRun()) return emit({ dryRun: true, harness, method: 'oauth', secret: spec.oauth.secret }, () =>
      console.log(c.yellow('dry-run: ') + `would run \`${spec.oauth!.cli} ${spec.oauth!.ttyArgs.join(' ')}\` → secret ${spec.oauth!.secret}`))
    console.log(c.dim(`Opening ${spec.oauth.cli} login — approve in your browser…`))
    let res: { secret: string }
    try {
      driveTtyLogin(harness)
      res = captureHarnessCreds(harness)
    } catch (e) { fail(e instanceof Error ? e.message : `${harness} login failed`) }
    return emit({ ok: true, harness, method: 'oauth', secret: res.secret }, () =>
      console.log(c.green('✓ ') + `${harness}: login captured as ${res.secret}. Select the harness with \`aeon config set harness ${harness}\`.`))
  }

  // --- Claude harness (default), unchanged ---
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
