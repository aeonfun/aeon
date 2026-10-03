// Paste detection for the Connect modal. Given whatever the operator pasted
// (a Claude setup-token, a provider API key, or a base64 login capture) and the
// harness being connected, decide which repo secret it belongs in and how to
// describe it ("Detected: Claude subscription (Pro/Max) -> CLAUDE_CODE_OAUTH_TOKEN").
//
// PURE: no node imports. The client runs detectPaste() for the live preview and
// the server runs the same function before saving, so the two can't disagree.
// Login captures are base64 tar.gz archives; the client only recognizes their
// shape, and the server (lib/connect-server.ts) gunzips them, reads them with
// parseTarEntries() + classifyCapture() below, and stores a clean re-pack built
// by buildTar() instead of the pasted bytes.
//
// Which secrets exist, their prefixes, labels and login paths all come from the
// generated manifests (lib/manifest.ts), never a local copy.

import { MANIFEST_GATEWAYS, MANIFEST_HARNESSES, harnessManifest, type ManifestCredential } from './manifest'
import { HARNESSES } from './constants'

// GitHub rejects secret values over 48 KB, so a bigger capture can never be
// stored. Measured on the base64 text, which is what gets saved.
export const CAPTURE_MAX_CHARS = 48 * 1024

const HARNESS_LABELS: Record<string, string> = Object.fromEntries(HARNESSES.map((h) => [h.id, h.label]))
export const harnessName = (h: string) => HARNESS_LABELS[h] ?? h
// Manifest labels, minus parenthetical detail ("OpenRouter key (one key covers...)").
const credLabel = (c: ManifestCredential) => c.label.replace(/\s*\(.*\)$/, '')

// --- providers (the override dropdown) ---------------------------------------

export interface ProviderOption { id: string; label: string; secret: string }

const slugOf = (secret: string) => secret.replace(/_(API_KEY|TOKEN)$/, '').toLowerCase().replace(/_/g, '-')

// Every pasteable key a provider can be pinned to: each claude gateway, then
// every other harness's API keys. Detection by prefix covers the common ones;
// the rest have no distinctive prefix and must be picked.
export const PROVIDER_OPTIONS: ProviderOption[] = (() => {
  const out: ProviderOption[] = []
  const seen = new Set<string>()
  const add = (o: ProviderOption) => { if (!seen.has(o.secret)) { seen.add(o.secret); out.push(o) } }
  for (const g of MANIFEST_GATEWAYS) {
    if (g.prefixes.some((p) => p.startsWith('sk-ant-oat'))) continue // a subscription token, not a key to pick
    add({ id: g.id, label: g.label, secret: g.secrets[0] })
  }
  for (const h of MANIFEST_HARNESSES) {
    for (const c of h.credentials) if (c.kind === 'api_key') add({ id: slugOf(c.secret), label: credLabel(c), secret: c.secret })
  }
  return out
})()

// Secrets a harness can actually run on: its own credentials plus, for the
// claude harness, every gateway key in the cascade.
export function acceptedSecrets(harness: string): string[] {
  const h = harnessManifest(harness)
  if (!h) return []
  const gw = h.gateways ? MANIFEST_GATEWAYS.flatMap((g) => g.secrets) : []
  return [...new Set([...h.credentials.map((c) => c.secret), ...gw])]
}

// The dropdown options that make sense for this harness.
export function providersForHarness(harness: string): ProviderOption[] {
  const ok = new Set(acceptedSecrets(harness))
  return PROVIDER_OPTIONS.filter((p) => ok.has(p.secret))
}

// Whether the harness can use the shared OpenRouter key (gates the one-click
// OpenRouter option). claude reaches it through the gateway.
export function acceptsOpenRouter(harness: string): boolean {
  return acceptedSecrets(harness).includes('OPENROUTER_API_KEY')
}

// --- login captures ----------------------------------------------------------

export interface CaptureSpec { harness: string; secret: string; paths: string[] }

// Where each CLI login lives under $HOME and the secret its tar+base64 capture
// is stored in: every oauth_capture credential in the manifest.
export const CAPTURE_SPECS: CaptureSpec[] = MANIFEST_HARNESSES.flatMap((h) =>
  h.credentials.filter((c) => c.kind === 'oauth_capture' && c.cred_paths?.length)
    .map((c) => ({ harness: h.id, secret: c.secret, paths: c.cred_paths! })))

// A gzip stream always starts 1f 8b 08, which base64-encodes to "H4sI".
export function looksLikeCapture(value: string): boolean {
  const v = value.replace(/\s+/g, '')
  return v.startsWith('H4sI') && /^[A-Za-z0-9+/]+=*$/.test(v)
}

export interface TarEntry { name: string; type: 'file' | 'dir'; mtime: number; data: Uint8Array }

// A tar the capture check refuses outright. The message is shown to the operator.
export class TarRefused extends Error {}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const cstr = (b: Uint8Array) => {
  const end = b.indexOf(0)
  return decoder.decode(end === -1 ? b : b.subarray(0, end))
}
const octal = (b: Uint8Array, what: string) => {
  const s = cstr(b).trim()
  if (!/^[0-7]*$/.test(s)) throw new TarRefused(`Not a tar archive (bad ${what} field).`)
  return parseInt(s || '0', 8)
}

// Pax keys that only carry metadata. Anything else (size, linkpath,
// GNU.sparse.*, ...) can change what tar extracts, so it is refused.
const PAX_OK = /^(path|mtime|atime|ctime|uid|gid|uname|gname|LIBARCHIVE\..+|SCHILY\.xattr\..+)$/

function parsePax(data: Uint8Array): Map<string, string> {
  const out = new Map<string, string>()
  let i = 0
  while (i < data.length) {
    if (data[i] === 0) break
    let sp = i
    while (sp < data.length && data[sp] !== 0x20) sp++
    const len = parseInt(decoder.decode(data.subarray(i, sp)), 10)
    if (!Number.isInteger(len) || len <= 0 || i + len > data.length || data[i + len - 1] !== 0x0a) throw new TarRefused('Malformed pax header in the archive.')
    const rec = decoder.decode(data.subarray(sp + 1, i + len - 1))
    const eq = rec.indexOf('=')
    if (eq <= 0) throw new TarRefused('Malformed pax header in the archive.')
    const key = rec.slice(0, eq)
    if (!PAX_OK.test(key)) throw new TarRefused(`The archive uses an unsupported tar field (${key}). Capture with the step 1 command.`)
    out.set(key, rec.slice(eq + 1)) // repeated keys: the LAST one wins, as in tar itself
    i += len
  }
  return out
}

// Read an uncompressed tar archive (ustar + pax, what bsdtar on macOS and GNU
// tar on Linux write for plain files). Only regular files and directories are
// accepted; links, devices, GNU long-name/sparse records and global pax headers
// are refused, and pax `path` resolves to the last record exactly as tar does,
// so what we classify is what the runner would extract.
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const out: TarEntry[] = []
  let off = 0
  let pax: Map<string, string> | null = null
  let ended = false
  while (off + 512 <= bytes.length) {
    const h = bytes.subarray(off, off + 512)
    if (h.every((x) => x === 0)) { ended = true; break }
    // Header checksum: sum of the header with the checksum field read as spaces.
    let sum = 0
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]
    if (octal(h.subarray(148, 156), 'checksum') !== sum) throw new TarRefused('Not a tar archive (checksum mismatch).')
    if (h[124] & 0x80) throw new TarRefused('Not a tar archive (oversized entry).')
    const size = octal(h.subarray(124, 136), 'size')
    const flag = String.fromCharCode(h[156])
    const dataStart = off + 512
    if (dataStart + size > bytes.length) throw new TarRefused('The capture is cut off. Copy it again in one piece.')
    const data = bytes.subarray(dataStart, dataStart + size)
    off = dataStart + Math.ceil(size / 512) * 512

    if (flag === 'x') {
      const next = parsePax(data)
      pax = new Map([...(pax ?? []), ...next])
      continue
    }
    if (flag !== '0' && flag !== '\0' && flag !== '7' && flag !== '5') {
      const what = flag === '1' || flag === '2' ? 'a link' : flag === 'g' ? 'a global header' : flag === 'L' || flag === 'K' ? 'a long-name record' : 'a special file'
      throw new TarRefused(`The archive contains ${what}. Capture only the files shown in step 1.`)
    }
    let name = cstr(h.subarray(0, 100))
    const prefix = cstr(h.subarray(345, 500))
    if (cstr(h.subarray(257, 262)) === 'ustar' && prefix) name = `${prefix}/${name}`
    let mtime = octal(h.subarray(136, 148), 'mtime')
    if (pax) {
      if (pax.has('path')) name = pax.get('path')!
      if (pax.has('mtime')) {
        const t = Number(pax.get('mtime'))
        if (Number.isFinite(t)) mtime = Math.floor(t)
      }
      pax = null
    }
    if (flag === '5' && size !== 0) throw new TarRefused('Not a tar archive (directory with data).')
    if (flag !== '5' && name.endsWith('/')) throw new TarRefused(`The archive has a file named like a folder (${name}).`)
    mtime = Math.min(Math.max(0, mtime), MAX_MTIME)
    out.push({ name, type: flag === '5' ? 'dir' : 'file', mtime, data: flag === '5' ? new Uint8Array(0) : data.slice() })
  }
  if (pax) throw new TarRefused('Malformed archive (dangling pax header).')
  if (!ended && off < bytes.length) throw new TarRefused('The capture is cut off. Copy it again in one piece.')
  if (out.length === 0) throw new TarRefused('The archive is empty.')
  return out
}

// The largest mtime an 11-digit octal ustar field holds.
export const MAX_MTIME = 8 ** 11 - 1

// A minimal ustar archive of regular files (mode 0600), for re-packing a
// verified capture so the stored secret holds nothing but those files.
export function buildTar(files: { name: string; data: Uint8Array; mtime: number }[]): Uint8Array {
  const blocks: Uint8Array[] = []
  const field = (h: Uint8Array, at: number, len: number, s: string) => h.set(encoder.encode(s).subarray(0, len), at)
  const oct = (n: number, len: number) => n.toString(8).padStart(len - 1, '0')
  for (const f of files) {
    const h = new Uint8Array(512)
    let name = f.name
    let prefix = ''
    if (encoder.encode(name).length > 100) {
      const cut = name.lastIndexOf('/', 155)
      prefix = name.slice(0, cut)
      name = name.slice(cut + 1)
      if (cut <= 0 || encoder.encode(name).length > 100 || encoder.encode(prefix).length > 155) throw new TarRefused(`Path too long: ${f.name}`)
    }
    field(h, 0, 100, name)
    field(h, 100, 8, oct(0o600, 8))
    field(h, 108, 8, oct(0, 8))
    field(h, 116, 8, oct(0, 8))
    field(h, 124, 12, oct(f.data.length, 12))
    const mtime = Number.isFinite(f.mtime) ? Math.min(Math.max(0, Math.floor(f.mtime)), MAX_MTIME) : 0
    field(h, 136, 12, oct(mtime, 12))
    h[156] = 0x30 // '0' regular file
    field(h, 257, 6, 'ustar')
    field(h, 263, 2, '00')
    field(h, 345, 155, prefix)
    h.fill(0x20, 148, 156)
    const sum = h.reduce((a, b) => a + b, 0)
    field(h, 148, 8, `${sum.toString(8).padStart(6, '0')}\0 `)
    blocks.push(h, f.data, new Uint8Array((512 - (f.data.length % 512)) % 512))
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0))
  let at = 0
  for (const b of blocks) { out.set(b, at); at += b.length }
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

export const normName = (n: string) => n.replace(/^(\.\/)+/, '').replace(/\/+$/, '')
// AppleDouble sidecars (._name) that macOS tar may add are metadata only.
export const isAppleDouble = (n: string) => normName(n).split('/').pop()!.startsWith('._')

// Map a capture's entries to the harness login it holds. Every entry must sit
// inside that harness's credential paths: the runner untars the secret into
// $HOME, so anything else (a dotfile, `..`, an absolute path) is refused.
export function classifyCapture(entries: { name: string; type: string }[]): Detection {
  for (const e of entries) {
    if (e.type === 'file' && /\/$/.test(e.name)) return { state: 'error', label: 'Login capture', note: `The archive has a file named like a folder (${e.name}).` }
  }
  const names = entries.map((e) => ({ ...e, name: normName(e.name) }))
  for (const e of names) {
    if (e.type !== 'file' && e.type !== 'dir') return { state: 'error', label: 'Login capture', note: `The archive contains a link or special file (${e.name}). Capture only the files shown in step 1.` }
    if (!e.name || e.name.startsWith('/') || e.name.split('/').includes('..')) return { state: 'error', label: 'Login capture', note: `Unsafe path in the archive: ${e.name || '(empty)'}` }
  }
  const real = names.filter((e) => !isAppleDouble(e.name))
  for (const spec of CAPTURE_SPECS) {
    const dirs = new Set(spec.paths.flatMap((p) => p.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))
    // Files must be a login path or sit under one; only directory entries may
    // also be one of the parent folders (a FILE called ".codex" is refused).
    const inside = (e: { name: string; type: string }) =>
      spec.paths.some((p) => e.name === p || e.name.startsWith(`${p}/`)) || (e.type === 'dir' && dirs.has(e.name))
    const files = real.filter((e) => e.type === 'file')
    if (!files.length || !real.every(inside)) continue
    // The first path is the login itself; the rest (config files) are optional.
    const main = spec.paths[0]
    if (!files.some((e) => e.name === main || e.name.startsWith(`${main}/`))) continue
    const cred = harnessManifest(spec.harness)?.credentials.find((c) => c.secret === spec.secret)
    const label = cred ? credLabel(cred) : `${harnessName(spec.harness)} login`
    return { state: 'ok', label, secret: spec.secret, captureHarness: spec.harness, note: `Saving also selects the ${harnessName(spec.harness)} harness.` }
  }
  const sample = real.slice(0, 3).map((e) => e.name).join(', ')
  return { state: 'error', label: 'Login capture', note: `Not a login Aeon knows (found ${sample || 'no files'}). Run the step 1 command as shown.` }
}

// --- keys ----------------------------------------------------------------------

interface PrefixRule { prefix: string; secret: string; label: string; rank: number }


// Prefix candidates for a paste on `harness`, from the manifests. Ranked: the
// harness's own credentials first, then the claude gateway cascade, then any
// other harness's credentials (saved with a "can't run on this" warning).
function prefixRules(harness: string): PrefixRule[] {
  const rules: PrefixRule[] = []
  const own = harnessManifest(harness)
  for (const c of own?.credentials ?? []) if (c.prefix) rules.push({ prefix: c.prefix, secret: c.secret, label: credLabel(c), rank: 0 })
  for (const g of MANIFEST_GATEWAYS) {
    const viaCred = MANIFEST_HARNESSES.flatMap((h) => h.credentials).find((c) => c.secret === g.secrets[0])
    for (const p of g.prefixes) rules.push({ prefix: p, secret: g.secrets[0], label: viaCred ? credLabel(viaCred) : `${g.label} key`, rank: own?.gateways ? 0 : 1 })
  }
  for (const h of MANIFEST_HARNESSES) {
    if (h.id === harness) continue
    for (const c of h.credentials) if (c.prefix) rules.push({ prefix: c.prefix, secret: c.secret, label: credLabel(c), rank: 2 })
  }
  return rules
}

function byPrefix(key: string, harness: string): { label: string; secret: string } | null {
  const hits = prefixRules(harness).filter((r) => key.startsWith(r.prefix))
  // Longest prefix wins (sk-or- over sk-); ties go to the better rank.
  hits.sort((a, b) => b.prefix.length - a.prefix.length || a.rank - b.rank)
  return hits[0] ? { label: hits[0].label, secret: hits[0].secret } : null
}

// A key that no prefix identifies falls back to the harness's only
// unprefixed API key (vibe -> MISTRAL_API_KEY, cursor, fx).
function soleKeySecret(harness: string): ManifestCredential | null {
  const keys = (harnessManifest(harness)?.credentials ?? []).filter((c) => c.kind === 'api_key' && !c.prefix)
  return keys.length === 1 ? keys[0] : null
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
    return fit({ state: 'ok', label: `${p.label} key`.replace(/ key key$/, ' key'), secret: p.secret })
  }

  const hit = byPrefix(value, harness)
  if (hit) return fit({ state: 'ok', ...hit })

  const sole = soleKeySecret(harness)
  if (sole) return { state: 'ok', label: credLabel(sole), secret: sole.secret }
  if (harnessManifest(harness)?.gateways) {
    return { state: 'ok', label: 'Anthropic-compatible key', secret: 'ANTHROPIC_API_KEY', needsProvider: true, note: 'No known prefix. If this is a gateway key (UsePod, Venice, GLM, HivemindOS...), pick it below.' }
  }
  return { state: 'error', label: 'Unrecognized key', needsProvider: true, note: 'Pick which provider this key is from.' }
}
