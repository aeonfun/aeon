// Server half of the Connect modal: authoritative detection (including opening
// login captures), saving the credential, and the local-only "Found on this
// machine" scan. Detection rules live in the pure lib/connect-detect.ts so the
// browser preview and this save path agree.
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { gunzipSync, gzipSync } from 'zlib'
import type { CommitResult } from './github'
import { isLocal } from './github'
import { setSecret } from './secrets-catalog'
import { syncGatewayProvider, syncHarness } from './gateway'
import { GATEWAY_SECRET_NAMES } from './gateway-registry'
import { CLAUDE_AUTH_SECRETS } from './constants'
import {
  CAPTURE_MAX_CHARS, CAPTURE_SPECS, TarRefused, acceptedSecrets, buildTar, classifyCapture, detectPaste, harnessName,
  isAppleDouble, parseTarEntries, type Detection, type TarEntry,
} from './connect-detect'
import type { Harness } from './types'

// A bad paste (wrong shape, unknown capture): the route answers 400.
export class ConnectInputError extends Error {}

// Open a base64 tar.gz login capture and work out which login it holds.
// Returns the detection plus the canonical single-line base64 to store.
export function inspectCapture(raw: string): { detection: Detection; value: string } {
  const b64 = raw.replace(/\s+/g, '')
  const fail = (note: string) => ({ detection: { state: 'error', label: 'Login capture', note } as Detection, value: '' })
  if (b64.length > CAPTURE_MAX_CHARS) {
    return fail(`This capture is ${Math.ceil(b64.length / 1024)} KB; GitHub secrets max out at 48 KB. Capture only the files in the step 1 command.`)
  }
  const bytes = Buffer.from(b64, 'base64')
  // Buffer.from silently skips junk; a strict round-trip catches a truncated paste.
  if (bytes.toString('base64').replace(/=+$/, '') !== b64.replace(/=+$/, '')) return fail('The capture is not valid base64. Copy it again in one piece.')
  let tar: Buffer
  try {
    tar = gunzipSync(bytes, { maxOutputLength: 4 * 1024 * 1024 })
  } catch {
    return fail('The capture is cut off or not a gzip archive. Copy it again in one piece.')
  }
  let entries: TarEntry[]
  try {
    entries = parseTarEntries(new Uint8Array(tar))
  } catch (e) {
    return fail(e instanceof TarRefused ? e.message : 'The capture is not a tar archive. Run the step 1 command as shown.')
  }
  const detection = classifyCapture(entries)
  if (detection.state !== 'ok') return { detection, value: '' }
  // Store a clean re-pack of just the verified regular files (no pax records,
  // AppleDouble sidecars, or directory entries), never the pasted bytes.
  const files = entries.filter((e) => e.type === 'file' && !isAppleDouble(e.name))
    .map((e) => ({ name: e.name.replace(/^(\.\/)+/, ''), data: e.data, mtime: e.mtime }))
  const value = gzipSync(Buffer.from(buildTar(files)), { level: 9 }).toString('base64')
  if (value.length > CAPTURE_MAX_CHARS) return fail('This capture is over 48 KB, the GitHub secret limit. Capture only the files in the step 1 command.')
  return { detection, value }
}

// detectPaste plus capture inspection: the full server-side answer.
export function detect(value: string, harness: string, provider = ''): { detection: Detection; value: string } {
  const d = detectPaste(value, harness, provider)
  if (d.state === 'pending') return inspectCapture(value)
  return { detection: d, value: value.trim() }
}

// Claude-harness secrets setSecret does not already re-sync the gateway for.
export function needsGatewaySync(secret: string): boolean {
  return CLAUDE_AUTH_SECRETS.includes(secret) && !GATEWAY_SECRET_NAMES.includes(secret)
}

export interface SaveResult {
  ok: true
  secret: string
  label: string
  // Set when a login capture switched aeon.yml's harness to its owner.
  harness?: string
  synced?: boolean
}

export interface SaveDeps {
  setSecret: (name: string, value: string) => Promise<void>
  syncHarness: (harness: Harness) => Promise<CommitResult>
  syncGateway: () => Promise<void>
}

const defaultDeps: SaveDeps = { setSecret, syncHarness, syncGateway: syncGatewayProvider }

// Detect, validate, and store a pasted credential for `harness`.
export async function saveConnection(
  input: { harness: string; value: string; provider?: string },
  deps: SaveDeps = defaultDeps,
): Promise<SaveResult> {
  const { detection, value } = detect(input.value, input.harness, input.provider)
  if (detection.state !== 'ok' || !detection.secret) {
    throw new ConnectInputError(detection.note || 'Nothing to save. Paste a key, token, or login capture.')
  }
  // setSecret re-syncs the gateway for gateway keys. The direct Claude
  // credentials (subscription token, Anthropic key) are not gateway keys, but
  // saving one must still pin gateway.provider to auto, as configureAuth does.
  await deps.setSecret(detection.secret, value)
  if (needsGatewaySync(detection.secret)) await deps.syncGateway()
  // A login capture only signs in its own CLI, so connecting it also selects
  // that harness (same as the one-click logins always did).
  if (detection.captureHarness) {
    const sync = await deps.syncHarness(detection.captureHarness as Harness)
    return { ok: true, secret: detection.secret, label: detection.label, harness: detection.captureHarness, synced: sync.synced }
  }
  return { ok: true, secret: detection.secret, label: detection.label }
}

// --- Found on this machine (local mode only) ---------------------------------

// Env vars in the dashboard's own process that hold a model key, by name. The
// secret has the same name.
export const FOUND_ENV_KEYS = [
  'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY',
  'MISTRAL_API_KEY', 'MOONSHOT_API_KEY', 'CURSOR_API_KEY', 'AI_GATEWAY_API_KEY',
]

export interface FoundItem {
  id: string
  kind: 'login' | 'env'
  label: string
  secret: string
}

// Logins and env keys on this machine that could connect `harness`. Names
// only, never values. (A claude setup-token is not stored anywhere readable,
// so it can't be found.)
export function listFound(harness: string): FoundItem[] {
  if (!isLocal()) return []
  const home = homedir()
  const items: FoundItem[] = []
  for (const spec of CAPTURE_SPECS) {
    if (spec.harness !== harness || !existsSync(join(home, spec.paths[0]))) continue
    items.push({ id: `login:${spec.harness}`, kind: 'login', label: `${harnessName(spec.harness)} login in ~/${spec.paths[0]}`, secret: spec.secret })
  }
  const accepted = acceptedSecrets(harness)
  for (const name of FOUND_ENV_KEYS) {
    if (process.env[name]?.trim() && accepted.includes(name)) {
      items.push({ id: `env:${name}`, kind: 'env', label: `${name} in the dashboard's environment`, secret: name })
    }
  }
  return items
}

// Capture/read a found item server-side and save it. Values never leave the
// server.
export async function connectFound(id: string, harness: string, deps: SaveDeps = defaultDeps): Promise<SaveResult> {
  if (!isLocal()) throw new ConnectInputError('Only available when the dashboard runs on your machine.')
  const item = listFound(harness).find((i) => i.id === id)
  if (!item) throw new ConnectInputError('That login or key is no longer on this machine. Refresh and try again.')
  if (item.kind === 'env') {
    await deps.setSecret(item.secret, process.env[item.secret]!.trim())
    if (needsGatewaySync(item.secret)) await deps.syncGateway()
    return { ok: true, secret: item.secret, label: item.secret }
  }
  const spec = CAPTURE_SPECS.find((s) => s.harness === harness)!
  const home = homedir()
  const present = spec.paths.filter((p) => existsSync(join(home, p)))
  const archive = execFileSync('tar', ['czf', '-', '-C', home, ...present], { maxBuffer: 8 * 1024 * 1024 })
  return saveConnection({ harness, value: archive.toString('base64') }, deps)
}
