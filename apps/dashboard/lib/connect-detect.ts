// Paste detection for the Connect modal. Given whatever the operator pasted
// (a Claude setup-token, a provider API key, or a base64 login capture) and the
// harness being connected, decide which repo secret it belongs in and how to
// describe it ("Detected: Claude subscription token -> CLAUDE_CODE_OAUTH_TOKEN").
//
// PURE: no node imports. The client runs detectPaste() for the live preview and
// the server runs the same function before saving, so the two can't disagree.
// Login captures are base64 tar.gz archives; the client only recognizes their
// shape, and the server (lib/connect-server.ts) gunzips them and hands the raw
// tar bytes to parseTarEntries() + classifyCapture() below to learn which
// harness they belong to.

import { GATEWAY_REGISTRY } from './gateway-registry'
import { HARNESS_AUTH } from './harness-auth'
import { authSecretsForHarness } from './constants'

// GitHub rejects secret values over 48 KB, so a bigger capture can never be
// stored. Measured on the base64 text, which is what gets saved.
export const CAPTURE_MAX_CHARS = 48 * 1024

// --- providers (the override dropdown) ---------------------------------------

export interface ProviderOption { id: string; label: string; secret: string }

// HivemindOS is a gateway the workflow resolves from HIVEMINDOS_CREDIT_TOKEN but
// that is not (yet) in the gateway registry; prefer the registry's name if it
// gets added there.
export const HIVEMINDOS_SECRET = (GATEWAY_REGISTRY as Record<string, { secretName: string } | undefined>).hivemindos?.secretName
  ?? 'HIVEMINDOS_CREDIT_TOKEN'

// Every provider a pasted key can be pinned to. Detection by prefix covers the
// common ones; the rest have no distinctive prefix and must be picked.
export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: 'anthropic', label: 'Anthropic', secret: 'ANTHROPIC_API_KEY' },
  { id: 'openrouter', label: 'OpenRouter', secret: GATEWAY_REGISTRY.openrouter.secretName },
  { id: 'openai', label: 'OpenAI', secret: 'OPENAI_API_KEY' },
  { id: 'xai', label: 'xAI', secret: GATEWAY_REGISTRY.grok.secretName },
  { id: 'bankr', label: 'Bankr', secret: GATEWAY_REGISTRY.bankr.secretName },
  { id: 'surplus', label: 'Surplus Intelligence', secret: GATEWAY_REGISTRY.surplus.secretName },
  { id: 'usepod', label: 'UsePod', secret: GATEWAY_REGISTRY.usepod.secretName },
  { id: 'venice', label: 'Venice', secret: GATEWAY_REGISTRY.venice.secretName },
  { id: 'glm', label: 'GLM (Z.AI)', secret: GATEWAY_REGISTRY.glm.secretName },
  { id: 'hivemindos', label: 'HivemindOS', secret: HIVEMINDOS_SECRET },
  { id: 'mistral', label: 'Mistral', secret: 'MISTRAL_API_KEY' },
  { id: 'moonshot', label: 'Moonshot', secret: 'MOONSHOT_API_KEY' },
  { id: 'cursor', label: 'Cursor', secret: 'CURSOR_API_KEY' },
  { id: 'ai-gateway', label: 'Vercel AI Gateway', secret: 'AI_GATEWAY_API_KEY' },
]

// Secrets a harness can actually run on. claude also takes the HivemindOS
// gateway token; pi additionally reads ANTHROPIC_OAUTH_TOKEN.
export function acceptedSecrets(harness: string): string[] {
  const base = authSecretsForHarness(harness)
  return harness === 'claude' ? [...base, HIVEMINDOS_SECRET] : base
}

// The dropdown options that make sense for this harness.
export function providersForHarness(harness: string): ProviderOption[] {
  const ok = new Set(acceptedSecrets(harness))
  return PROVIDER_OPTIONS.filter((p) => ok.has(p.secret))
}

// Whether the harness can use the shared OpenRouter key (gates the one-click
// OpenRouter option). claude reaches it through the gateway.
export function acceptsOpenRouter(harness: string): boolean {
  return acceptedSecrets(harness).includes(GATEWAY_REGISTRY.openrouter.secretName)
}

// --- login captures ----------------------------------------------------------

export interface CaptureSpec { harness: string; secret: string; paths: string[] }

// Where each CLI login lives under $HOME and the secret its tar+base64 capture
// is stored in. codex/kimi/hermes come from the harness registry; grok's is
// fixed (app/api/grok-auth, scripts/run-grok.sh).
export const CAPTURE_SPECS: CaptureSpec[] = [
  ...Object.entries(HARNESS_AUTH).flatMap(([harness, spec]) =>
    spec?.oauth ? [{ harness, secret: spec.oauth.secret, paths: spec.oauth.credPaths }] : []),
  { harness: 'grok', secret: 'GROK_CREDENTIALS', paths: ['.grok/auth.json'] },
]

// A gzip stream always starts 1f 8b 08, which base64-encodes to "H4sI".
export function looksLikeCapture(value: string): boolean {
  const v = value.replace(/\s+/g, '')
  return v.startsWith('H4sI') && /^[A-Za-z0-9+/]+=*$/.test(v)
}

export interface TarEntry { name: string; type: 'file' | 'dir' | 'link' | 'other' }

const decoder = new TextDecoder()
const cstr = (b: Uint8Array) => {
  const end = b.indexOf(0)
  return decoder.decode(end === -1 ? b : b.subarray(0, end))
}

// List the entries of an uncompressed tar archive (ustar, GNU long names, and
// pax path records, which is what bsdtar on macOS and GNU tar on Linux write).
// Throws on anything that isn't a well-formed archive.
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const out: TarEntry[] = []
  let off = 0
  let longName = ''
  while (off + 512 <= bytes.length) {
    const h = bytes.subarray(off, off + 512)
    if (h.every((x) => x === 0)) break
    const sizeField = cstr(h.subarray(124, 136)).trim()
    if (!/^[0-7]*$/.test(sizeField)) throw new Error('not a tar archive')
    const size = parseInt(sizeField || '0', 8)
    const flag = String.fromCharCode(h[156] || 48)
    const prefix = cstr(h.subarray(345, 500))
    let name = cstr(h.subarray(0, 100))
    if (cstr(h.subarray(257, 262)) === 'ustar' && prefix) name = `${prefix}/${name}`
    const data = bytes.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (off > bytes.length + 512) throw new Error('truncated tar archive')

    if (flag === 'L') { longName = cstr(data); continue } // GNU long name for the next entry
    if (flag === 'x') { // pax extended header: "<len> key=value\n" records
      const m = decoder.decode(data).match(/\d+ path=([^\n]*)\n/)
      if (m) longName = m[1]
      continue
    }
    if (flag === 'g') continue // global pax header
    if (longName) { name = longName; longName = '' }
    const type: TarEntry['type'] = flag === '0' || flag === '\0' || flag === '7' ? 'file'
      : flag === '5' ? 'dir'
      : flag === '1' || flag === '2' ? 'link'
      : 'other'
    out.push({ name, type })
  }
  if (out.length === 0) throw new Error('empty tar archive')
  return out
}

export interface Detection {
  // ok: savable as shown. pending: a capture the server still has to open.
  state: 'empty' | 'ok' | 'pending' | 'error'
  label: string
  secret?: string
  // For a login capture: the harness it signs in (saving it switches to it).
  captureHarness?: string
  // Shown under the preview line; a warning when `warn` is set.
  note?: string
  warn?: boolean
  // The key has no recognizable prefix: show the provider dropdown.
  needsProvider?: boolean
}

const LABELS: Record<string, string> = { codex: 'Codex (ChatGPT) login', kimi: 'Kimi login', hermes: 'Hermes (Nous Portal) login', grok: 'Grok (X account) login' }

// Map a capture's entry names to the harness login it holds. Every entry must
// sit inside that harness's credential paths: the runner untars the secret into
// $HOME, so anything else (a dotfile, `..`, a symlink) is refused outright.
export function classifyCapture(entries: TarEntry[]): Detection {
  const names = entries.map((e) => ({ ...e, name: e.name.replace(/^\.\//, '').replace(/\/$/, '') }))
  for (const e of names) {
    if (e.type === 'link' || e.type === 'other') return { state: 'error', label: 'Login capture', note: `The archive contains a link or special file (${e.name}). Capture only the files shown in step 1.` }
    if (e.name.startsWith('/') || e.name.split('/').includes('..')) return { state: 'error', label: 'Login capture', note: `Unsafe path in the archive: ${e.name}` }
  }
  // AppleDouble sidecars (._name) that macOS tar may add are harmless metadata.
  const real = names.filter((e) => !e.name.split('/').pop()!.startsWith('._'))
  for (const spec of CAPTURE_SPECS) {
    const dirs = new Set(spec.paths.flatMap((p) => p.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))
    const inside = (n: string) => spec.paths.some((p) => n === p || n.startsWith(`${p}/`)) || dirs.has(n)
    const files = real.filter((e) => e.type === 'file')
    if (!files.length || !files.every((e) => inside(e.name))) continue
    if (!real.every((e) => inside(e.name))) continue
    // The first path is the login itself; the rest (config files) are optional.
    const main = spec.paths[0]
    if (!files.some((e) => e.name === main || e.name.startsWith(`${main}/`))) continue
    return { state: 'ok', label: LABELS[spec.harness] ?? `${spec.harness} login`, secret: spec.secret, captureHarness: spec.harness, note: `Saving also selects the ${harnessName(spec.harness)} harness.` }
  }
  const sample = real.slice(0, 3).map((e) => e.name).join(', ')
  return { state: 'error', label: 'Login capture', note: `Not a login Aeon knows (found ${sample || 'no files'}). Run the step 1 command as shown.` }
}

// --- keys ----------------------------------------------------------------------

const HARNESS_NAMES: Record<string, string> = { claude: 'Claude', codex: 'Codex', grok: 'Grok', kimi: 'Kimi', pi: 'Pi', vibe: 'Mistral', fx: 'fx', cursor: 'Cursor', hermes: 'Hermes' }
export const harnessName = (h: string) => HARNESS_NAMES[h] ?? h

// A key that no prefix identifies falls back to the harness's only key secret.
const SOLE_KEY_SECRET: Record<string, string> = { vibe: 'MISTRAL_API_KEY', cursor: 'CURSOR_API_KEY', fx: 'AI_GATEWAY_API_KEY' }

function byPrefix(key: string, harness: string): { label: string; secret: string } | null {
  if (key.startsWith('sk-ant-oat')) {
    return harness === 'pi'
      ? { label: 'Claude subscription token', secret: 'ANTHROPIC_OAUTH_TOKEN' }
      : { label: 'Claude subscription token', secret: 'CLAUDE_CODE_OAUTH_TOKEN' }
  }
  if (key.startsWith('sk-ant-')) return { label: 'Anthropic API key', secret: 'ANTHROPIC_API_KEY' }
  for (const [slug, def] of Object.entries(GATEWAY_REGISTRY)) {
    if (def.prefixes.some((p: string) => key.startsWith(p))) {
      return { label: slug === 'grok' ? 'xAI API key' : `${def.label} key`, secret: def.secretName }
    }
  }
  // Plain sk- is OpenAI's shape, and also Moonshot's, so lean on the harness.
  if (key.startsWith('sk-')) {
    return harness === 'kimi'
      ? { label: 'Moonshot API key', secret: 'MOONSHOT_API_KEY' }
      : { label: 'OpenAI API key', secret: 'OPENAI_API_KEY' }
  }
  return null
}

// Decide what a paste is. `provider` (from the dropdown) overrides detection.
export function detectPaste(raw: string, harness: string, provider = ''): Detection {
  const value = raw.trim()
  if (!value) return { state: 'empty', label: '' }

  if (looksLikeCapture(value)) {
    const size = value.replace(/\s+/g, '').length
    if (size > CAPTURE_MAX_CHARS) {
      return { state: 'error', label: 'Login capture', note: `This capture is ${Math.ceil(size / 1024)} KB; GitHub secrets max out at 48 KB. Capture only the files in the step 1 command.` }
    }
    return { state: 'pending', label: 'Login capture', note: 'Checking which login this is...' }
  }
  if (/\s/.test(value)) return { state: 'error', label: 'Unrecognized', note: 'That looks like more than one value. Paste a single key or token.' }

  const accepted = acceptedSecrets(harness)
  const fit = (d: Detection): Detection => {
    if (!d.secret || accepted.includes(d.secret)) return d
    return { ...d, warn: true, note: `The ${harnessName(harness)} harness can't run on this. It will be saved, but switch harness to use it.` }
  }

  if (provider) {
    const p = PROVIDER_OPTIONS.find((o) => o.id === provider)
    if (!p) return { state: 'error', label: 'Unrecognized', note: `Unknown provider: ${provider}` }
    return fit({ state: 'ok', label: `${p.label} key`, secret: p.secret })
  }

  const hit = byPrefix(value, harness)
  if (hit) return fit({ state: 'ok', ...hit })

  const sole = SOLE_KEY_SECRET[harness]
  if (sole) return { state: 'ok', label: `${harnessName(harness)} key`, secret: sole }
  if (harness === 'claude') {
    return { state: 'ok', label: 'Anthropic-compatible key', secret: 'ANTHROPIC_API_KEY', needsProvider: true, note: 'No known prefix. If this is a gateway key (UsePod, Venice, GLM, HivemindOS...), pick it below.' }
  }
  return { state: 'error', label: 'Unrecognized key', needsProvider: true, note: 'Pick which provider this key is from.' }
}
