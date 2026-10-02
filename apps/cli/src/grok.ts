// Grok Build (`grok`) credential capture for the CLI - the terminal twin of the
// dashboard's "Connect X account" (app/api/grok-auth/route.ts): run
// `grok login --device-auth`, then tar+base64 ~/.grok/auth.json into the
// GROK_CREDENTIALS secret, which scripts/run-grok.sh restores before each run.
// grok is not in lib/harness-auth.ts (its route predates that registry), so
// `aeon auth --harness grok` and `aeon init` share this instead.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ghSecretSet } from '../../dashboard/lib/gh.ts'
import { syncGatewayProvider } from '../../dashboard/lib/gateway.ts'

const AUTH_FILE = '.grok/auth.json'

// Interactive: grok prints the device URL and opens the browser itself.
export function grokLogin(): { secret: string } {
  const res = spawnSync('grok', ['login', '--device-auth'], { stdio: 'inherit' })
  if (res.error) {
    throw new Error((res.error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'grok CLI not found. Install it: npm i -g @xai-official/grok'
      : res.error.message)
  }
  if (res.status !== 0) throw new Error(`grok login exited ${res.status}`)
  const home = homedir()
  if (!existsSync(join(home, AUTH_FILE))) {
    throw new Error('Login finished but no ~/.grok/auth.json was found. Run `grok login` in a terminal, then try again.')
  }
  const archive = execFileSync('tar', ['czf', '-', '-C', home, AUTH_FILE], { maxBuffer: 8 * 1024 * 1024 })
  ghSecretSet('GROK_CREDENTIALS', archive.toString('base64'))
  return { secret: 'GROK_CREDENTIALS' }
}

// XAI_API_KEY is also the Grok gateway secret, so keep the gateway on auto.
export async function storeGrokKey(key: string): Promise<{ secret: string }> {
  ghSecretSet('XAI_API_KEY', key.trim())
  await syncGatewayProvider()
  return { secret: 'XAI_API_KEY' }
}
