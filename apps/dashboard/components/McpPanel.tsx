'use client'

import { useState, useEffect } from 'react'
import { MCP_CATALOG, tokenVar } from '../lib/mcp-catalog'
import type { Secret, McpServer, McpServers, McpAuthResponse } from '../lib/types'
import { McpLogo } from './ui/McpLogo'
import { Section } from './ui/Section'
import { CheckLightIcon } from './glass/d/icons'
import {
  ActionButton,
  ATTN,
  Callout,
  CARD,
  EmptyState,
  Field,
  LINK,
  LIST,
  Loading,
  NewTab,
  PageHeader,
  PrimaryButton,
  TAG,
  TAG_ATTN,
  TAG_INK,
  TAG_MUTED,
} from './glass/connect/ui'
import { SegmentedChoice } from './glass/connect/forms'
import { cn } from '@/lib/cn'

// One-click starters - public HTTP MCP servers that install with no token.
const FEATURED = MCP_CATALOG

interface McpPanelProps {
  servers: McpServers
  loading: boolean
  saving: boolean
  secrets: Secret[]
  busy: Record<string, boolean>
  onSave: (servers: McpServers) => void
  onSetSecret: (name: string, value: string) => void
  onDeleteSecret: (name: string) => void
  onGoToSecret: (name: string) => void
}

// The ${VAR} secret references a server needs at runtime.
function refsOf(server: McpServer): string[] {
  const out = new Set<string>()
  const re = /\$\{([A-Z_][A-Z0-9_]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(JSON.stringify(server)))) out.add(m[1])
  return [...out]
}

function describe(server: McpServer): string {
  if (typeof server.url === 'string') return server.url
  if (typeof server.command === 'string') {
    const args = Array.isArray(server.args) ? ' ' + server.args.join(' ') : ''
    return server.command + args
  }
  return '-'
}

function transportOf(server: McpServer): string {
  if (typeof server.type === 'string') return server.type
  return typeof server.command === 'string' ? 'stdio' : 'http'
}

export function McpPanel({
  servers,
  loading,
  saving,
  secrets,
  busy,
  onSave,
  onSetSecret,
  onDeleteSecret,
  onGoToSecret,
}: McpPanelProps) {
  const [draft, setDraft] = useState<McpServers>(servers)
  useEffect(() => {
    setDraft(servers)
  }, [servers])

  // Per-row token entry - set an existing server's referenced secret inline,
  // exactly like a credential row in Settings (paste value, Set, saved to GH).
  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({})
  const isSecretSet = (n: string) => secrets.some(s => s.name === n && s.isSet)
  const saveRowSecret = (n: string) => {
    const v = (secretDraft[n] ?? '').trim()
    if (!v) return
    onSetSecret(n, v)
    setSecretDraft(d => ({ ...d, [n]: '' }))
  }

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<'http' | 'stdio'>('http')
  const [url, setUrl] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [command, setCommand] = useState('npx')
  const [args, setArgs] = useState('')

  // OAuth connect (featured servers flagged `oauth`): the dashboard drives the
  // browser flow server-side (POST /api/mcp-auth), which captures the tokens as
  // secrets and returns the server descriptor to add. Per-slug busy + error.
  const [oauthBusy, setOauthBusy] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState('')

  // The operator never types a secret name. They paste the bearer token (which
  // IS the secret); tokenVar (lib/mcp-catalog) derives the env-var to store it
  // under from the server name - the same derivation the OAuth flow and the
  // Access Keys MCP group use, so all three agree on what a server's creds are called.
  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '')

  const dirty = JSON.stringify(draft) !== JSON.stringify(servers)
  const names = Object.keys(draft)
  const allRefs = [...new Set(names.flatMap(n => refsOf(draft[n])))]

  const resetForm = () => {
    setAdding(false)
    setName('')
    setUrl('')
    setBearerToken('')
    setCommand('npx')
    setArgs('')
    setTransport('http')
  }

  const addServer = () => {
    const slug = slugify(name)
    if (!slug) return
    let server: McpServer
    if (transport === 'http') {
      if (!url.trim()) return
      server = { type: 'http', url: url.trim() }
      if (bearerToken.trim()) {
        // The token IS the secret. Derive its var from the server name, store
        // the value on GH, and reference it in .mcp.json - no name to type.
        const varName = tokenVar(slug)
        server.headers = { Authorization: `Bearer \${${varName}}` }
        onSetSecret(varName, bearerToken.trim())
      }
    } else {
      if (!command.trim()) return
      server = { type: 'stdio', command: command.trim() }
      if (args.trim()) server.args = args.trim().split(/\s+/)
    }
    setDraft({ ...draft, [slug]: server })
    resetForm()
  }

  // A credential this panel minted for a server is stored as MCP_<SLUG>_TOKEN.
  const isMcpToken = (r: string) => /^MCP_[A-Z0-9_]+_TOKEN$/.test(r)

  // One-click install a featured server: add it to .mcp.json and persist
  // immediately (same as Save). Public / OAuth / x402 servers need no token; a
  // server with `authSecret` installs with an `Authorization: Bearer ${VAR}`
  // header, and the per-row paste-token box below collects the key (runs skip
  // MCP with a warning until it's set, same as any unset ref).
  const isFeaturedInstalled = (url: string) => Object.values(draft).some(s => s.url === url)
  const installFeatured = (f: (typeof FEATURED)[number]) => {
    if (isFeaturedInstalled(f.url)) return
    if (f.oauth) {
      connectOAuth(f)
      return
    }
    const slug = draft[f.slug] ? `${f.slug}-mcp` : f.slug
    const server: McpServer = { type: f.transport ?? 'http', url: f.url }
    if (f.authSecret) server.headers = { Authorization: `Bearer \${${f.authSecret}}` }
    const next = { ...draft, [slug]: server }
    setDraft(next)
    onSave(next)
  }

  // Run the browser OAuth flow for a featured server, then add the returned
  // descriptor via the normal save path. The tokens are captured + stored
  // server-side; the panel never sees them.
  const connectOAuth = async (f: (typeof FEATURED)[number]) => {
    const slug = draft[f.slug] ? `${f.slug}-mcp` : f.slug
    setOauthBusy(f.slug)
    setOauthError('')
    try {
      const res = await fetch('/api/mcp-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, url: f.url, name: f.name, scopes: f.oauthScopes, clientId: f.oauthClientId }),
      })
      const data = (await res.json().catch(() => ({}))) as McpAuthResponse
      if (!res.ok || !data.ok) throw new Error(data.error || `Connect failed (${res.status})`)
      if (!data.server) throw new Error('Connect returned no server descriptor')
      const next = { ...draft, [slug]: data.server }
      setDraft(next)
      onSave(next)
      if (data.warning)
        setOauthError(
          f.oauthSession && data.durable === false ? `Connected. ${f.oauthSession}` : `Connected, but: ${data.warning}`,
        )
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'OAuth connect failed')
    } finally {
      setOauthBusy(null)
    }
  }

  const removeServer = (n: string) => {
    const next = { ...draft }
    delete next[n]
    // Any MCP token this server owned that nothing else references is now orphaned
    // on GitHub - delete it so removing a server actually removes its credentials.
    // Only touch panel-minted MCP_*_TOKEN secrets, never shared/builtin ones.
    const stillUsed = new Set(Object.values(next).flatMap(refsOf))
    const orphans = refsOf(draft[n]).filter(r => isMcpToken(r) && !stillUsed.has(r) && isSecretSet(r))
    if (
      orphans.length &&
      !confirm(
        `Remove server "${n}" and delete its credential${orphans.length === 1 ? '' : 's'} (${orphans.join(', ')}) from GitHub?`,
      )
    )
      return
    orphans.forEach(onDeleteSecret)
    setDraft(next)
  }

  return (
    <div className="space-y-[clamp(36px,4vw,56px)]">
      <PageHeader title="MCP servers" sub="Servers your skills can call during a run: GitHub, a database, a paid API.">
        <p className="mt-2 max-w-[78ch] text-[15px] leading-[1.55] text-muted-foreground">
          Want the other direction? Drive this agent from ChatGPT, Claude or Cursor with the hosted MCP server:{' '}
          <a href="https://www.aeon.fun/connect/mcp" target="_blank" rel="noopener noreferrer" className={LINK}>
            www.aeon.fun/connect/mcp
            <NewTab />
          </a>
        </p>
      </PageHeader>

      <Section
        label="Featured"
        action={<span className="font-mono text-[12px] text-muted-foreground">One-click install</span>}
      >
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {FEATURED.map(f => {
            const installed = isFeaturedInstalled(f.url)
            return (
              <li key={f.slug} className={cn(CARD, 'flex items-center gap-3 px-4 py-3.5')}>
                <McpLogo src={f.logo} size={40} className="size-10 rounded-[12px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{f.name}</p>
                  <div className="truncate font-mono text-[12px] text-muted-foreground">{f.url}</div>
                </div>
                {installed ? (
                  <span className={cn(TAG, TAG_INK, 'shrink-0 gap-1')}>
                    <CheckLightIcon className="size-3" />
                    Installed
                  </span>
                ) : (
                  <ActionButton
                    onClick={() => installFeatured(f)}
                    disabled={saving || oauthBusy === f.slug}
                    className="shrink-0"
                    title={f.oauth ? 'Opens your browser to authorize, then stores the tokens' : undefined}
                  >
                    {oauthBusy === f.slug ? 'Connecting' : f.oauth ? 'Connect' : 'Install'}
                  </ActionButton>
                )}
              </li>
            )
          })}
        </ul>
        {oauthError && (
          <p role="alert" className={cn('mt-3 text-[14px] leading-[1.5]', ATTN)}>
            {oauthError}
          </p>
        )}
        {/* Secrets-PAT setup section. OAuth providers rotate their refresh token
            on every run; the runner can only save each rotation back if a
            secrets-write PAT is set. Without one, an OAuth MCP server works for
            exactly one run after Connect and then its auth breaks. Shown until
            GH_SECRETS_PAT (or repo-wide GH_GLOBAL) exists; hidden once set. */}
        {!(isSecretSet('GH_SECRETS_PAT') || isSecretSet('GH_GLOBAL')) && (
          <Callout attention className="mt-4" title="OAuth MCP servers won't keep working without a secrets PAT">
            <p>
              Providers rotate their refresh token on every run, and the runner needs a secrets-write credential to save
              each rotation. Without it a Connected server works once, then its auth breaks. To set it up: create a
              fine-grained PAT at{' '}
              <a
                href="https://github.com/settings/personal-access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK}
              >
                github.com/settings/personal-access-tokens
                <NewTab />
              </a>
              , add this repo under <span className="font-medium text-foreground">Repository access</span>, grant{' '}
              <span className="font-medium text-foreground">Secrets: Read and write</span>, and save it as{' '}
              <button
                type="button"
                onClick={() => onGoToSecret('GH_SECRETS_PAT')}
                title="Open in Keys to set this key"
                className={cn(LINK, 'font-mono text-[14px]')}
              >
                GH_SECRETS_PAT
              </button>{' '}
              in Keys. Already Connected a server? Re-connect it once after adding the PAT.
            </p>
            {isSecretSet('MCP_SECRETS_PAT') && (
              <p className="mt-2">
                You have a <span className="font-mono text-[14px] text-foreground">MCP_SECRETS_PAT</span> from before
                the rename; the runner no longer reads it. Rename it to{' '}
                <button
                  type="button"
                  onClick={() => onGoToSecret('GH_SECRETS_PAT')}
                  title="Open in Keys to set this key"
                  className={cn(LINK, 'font-mono text-[14px]')}
                >
                  GH_SECRETS_PAT
                </button>{' '}
                (save the same PAT under the new name), then remove MCP_SECRETS_PAT.
              </p>
            )}
          </Callout>
        )}
      </Section>

      <Section
        label=".mcp.json"
        action={
          <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
            {names.length} server{names.length === 1 ? '' : 's'}
          </span>
        }
      >
        {loading ? (
          <Loading label="Loading servers" />
        ) : (
          <>
            {names.length > 0 ? (
              <ul className={cn(LIST, 'flex flex-col gap-0.5')}>
                {names.map(n => {
                  const s = draft[n]
                  const refs = refsOf(s)
                  return (
                    <li
                      key={n}
                      className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 rounded-[14px] px-3.5 py-3.5"
                    >
                      <div className="min-w-0 flex-1 basis-[16rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[14px] font-medium">{n}</span>
                          <span className={cn(TAG, TAG_MUTED)}>{transportOf(s)}</span>
                        </div>
                        <div className="mt-1 truncate font-mono text-[12px] text-muted-foreground">{describe(s)}</div>
                        {refs.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {refs.map(r => {
                              const ok = isSecretSet(r)
                              const pending = !!busy[`sec-${r}`]
                              return (
                                <li key={r} className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      TAG,
                                      'shrink-0 font-normal normal-case tracking-normal',
                                      ok ? TAG_INK : TAG_ATTN,
                                    )}
                                  >
                                    ${'{'}
                                    {r}
                                    {'}'}
                                  </span>
                                  {ok ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted-foreground">
                                      <CheckLightIcon className="size-3.5" />
                                      Set
                                    </span>
                                  ) : pending ? (
                                    <span className="font-mono text-[12px] text-muted-foreground">Setting</span>
                                  ) : (
                                    <>
                                      <span className={cn('font-mono text-[12px]', ATTN)}>Not set</span>
                                      <div className="flex w-full items-center gap-2">
                                        <Field
                                          label={`Token for ${r}`}
                                          hideLabel
                                          type="password"
                                          value={secretDraft[r] ?? ''}
                                          onChange={e => setSecretDraft(d => ({ ...d, [r]: e.target.value }))}
                                          onKeyDown={e => e.key === 'Enter' && saveRowSecret(r)}
                                          placeholder="Paste the bearer token: saved to GitHub and wired in"
                                          className="min-w-0 flex-1"
                                        />
                                        <ActionButton
                                          onClick={() => saveRowSecret(r)}
                                          disabled={!(secretDraft[r] ?? '').trim()}
                                          className="h-12 shrink-0 px-5"
                                        >
                                          Set
                                        </ActionButton>
                                      </div>
                                    </>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                      <ActionButton onClick={() => removeServer(n)} className={cn('shrink-0', ATTN)}>
                        Remove
                      </ActionButton>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className={CARD}>
                <EmptyState title="No servers yet" hint="Install a featured one above, or add your own below." />
              </div>
            )}

            {/* Add form */}
            <div className="mt-4">
              {adding ? (
                <div className={cn(CARD, 'space-y-4 p-4 sm:p-5')}>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field
                      label="Server name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. github"
                      autoFocus
                      className="min-w-0 flex-1 basis-[14rem]"
                    />
                    <SegmentedChoice
                      variant="group"
                      label="Transport"
                      value={transport}
                      options={[
                        { id: 'http', label: 'http' },
                        { id: 'stdio', label: 'stdio' },
                      ]}
                      onChange={setTransport}
                      className="mb-1"
                    />
                  </div>
                  {transport === 'http' ? (
                    <>
                      <Field
                        label="URL"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="https://mcp.example.com/v1"
                        inputMode="url"
                      />
                      <Field
                        label="Bearer token (optional)"
                        type="password"
                        value={bearerToken}
                        onChange={e => setBearerToken(e.target.value)}
                        placeholder="Paste it: saved to GitHub and wired in"
                      />
                      {bearerToken.trim() && slugify(name) && (
                        <p className="px-1 text-[14px] leading-[1.5] text-muted-foreground">
                          Stored as secret <span className="font-mono text-foreground">{tokenVar(slugify(name))}</span>,
                          referenced from this server in <span className="font-mono text-foreground">.mcp.json</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Field
                        label="Command"
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        placeholder="e.g. npx"
                      />
                      <Field
                        label="Args, space-separated"
                        value={args}
                        onChange={e => setArgs(e.target.value)}
                        placeholder="e.g. -y @modelcontextprotocol/server-sequential-thinking"
                      />
                    </>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton onClick={resetForm}>Cancel</ActionButton>
                    <PrimaryButton onClick={addServer}>Add server</PrimaryButton>
                  </div>
                </div>
              ) : (
                <ActionButton onClick={() => setAdding(true)} className="h-12 w-full">
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Add server
                </ActionButton>
              )}
            </div>

            {/* Footer: secrets reminder + save */}
            {allRefs.some(r => !isSecretSet(r)) && (
              <p className="mt-5 max-w-[78ch] text-[14px] leading-[1.55] text-muted-foreground">
                <span className="font-medium text-foreground">Secrets:</span> paste each unset token in the box on its
                server above. It saves straight to GitHub and the runner wires it into every run automatically. Until
                set, runs skip MCP rather than fail.
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {dirty && <ActionButton onClick={() => setDraft(servers)}>Revert</ActionButton>}
              <PrimaryButton onClick={() => onSave(draft)} disabled={!dirty || saving}>
                {saving ? 'Saving' : 'Save'}
              </PrimaryButton>
            </div>
          </>
        )}
      </Section>
    </div>
  )
}
