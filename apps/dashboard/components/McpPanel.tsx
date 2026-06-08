'use client'

import { useState, useEffect } from 'react'
import { Scramble } from './ui/Animated'
import { inputCls } from '../lib/utils'

type McpServer = Record<string, unknown>
type McpServers = Record<string, McpServer>

interface McpPanelProps {
  servers: McpServers
  loading: boolean
  saving: boolean
  onSave: (servers: McpServers) => void
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
    const args = Array.isArray(server.args) ? ' ' + (server.args as string[]).join(' ') : ''
    return server.command + args
  }
  return '—'
}

function transportOf(server: McpServer): string {
  if (typeof server.type === 'string') return server.type
  return typeof server.command === 'string' ? 'stdio' : 'http'
}

export function McpPanel({ servers, loading, saving, onSave }: McpPanelProps) {
  const [draft, setDraft] = useState<McpServers>(servers)
  useEffect(() => { setDraft(servers) }, [servers])

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<'http' | 'stdio'>('http')
  const [url, setUrl] = useState('')
  const [secretVar, setSecretVar] = useState('')
  const [command, setCommand] = useState('npx')
  const [args, setArgs] = useState('')

  const dirty = JSON.stringify(draft) !== JSON.stringify(servers)
  const names = Object.keys(draft)
  const allRefs = [...new Set(names.flatMap(n => refsOf(draft[n])))]

  const resetForm = () => {
    setAdding(false); setName(''); setUrl(''); setSecretVar(''); setCommand('npx'); setArgs(''); setTransport('http')
  }

  const addServer = () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return
    let server: McpServer
    if (transport === 'http') {
      if (!url.trim()) return
      server = { type: 'http', url: url.trim() }
      if (secretVar.trim()) server.headers = { Authorization: `Bearer \${${secretVar.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')}}` }
    } else {
      if (!command.trim()) return
      server = { type: 'stdio', command: command.trim() }
      if (args.trim()) server.args = args.trim().split(/\s+/)
    }
    setDraft({ ...draft, [slug]: server })
    resetForm()
  }

  const removeServer = (n: string) => {
    const next = { ...draft }; delete next[n]; setDraft(next)
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
            <span className="w-7 h-px bg-aeon-red" />
            Tools · Model Context Protocol
          </span>
          <h1 className="mt-4 font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble text="MCP" />{' '}
            <span className="text-aeon-red"><Scramble text="SERVERS" delay={160} /></span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            Servers your skills can <span className="text-primary-100">call</span> during a run — GitHub, a database,
            a paid API. Saved to <span className="font-mono text-primary-100">.mcp.json</span> and loaded on every run.
          </p>
        </div>
      </section>

      <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">01 / .mcp.json</span>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-35">{names.length} server{names.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="text-xs font-mono text-primary-40 py-8">Loading…</div>
        ) : (
          <>
            {names.length > 0 ? (
              <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
                {names.map(n => {
                  const s = draft[n]
                  const refs = refsOf(s)
                  return (
                    <div key={n} className="px-[var(--space-md)] py-[var(--space-sm)] flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary-100">{n}</span>
                          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-primary-40 border border-[rgba(250,250,250,0.12)] px-1.5 py-0.5">{transportOf(s)}</span>
                        </div>
                        <div className="text-[11px] text-primary-40 font-mono truncate mt-0.5">{describe(s)}</div>
                        {refs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {refs.map(r => (
                              <span key={r} className="text-[10px] font-mono text-eva-orange border border-eva-orange/30 px-1.5 py-0.5">${'{'}{r}{'}'}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeServer(n)} className="text-[11px] text-eva-red/50 hover:text-eva-red font-mono px-2 py-1 transition-colors shrink-0">Remove</button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs font-mono text-primary-40 py-6 border border-dashed border-[rgba(250,250,250,0.10)] text-center">No servers yet. Add one below.</div>
            )}

            {/* Add form */}
            <div className="mt-4">
              {adding ? (
                <div className="border border-[rgba(250,250,250,0.10)] p-[var(--space-md)] space-y-3">
                  <div className="flex gap-2">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="server name (e.g. github)" autoFocus className={inputCls} />
                    <div className="flex shrink-0 border border-[rgba(250,250,250,0.10)]">
                      {(['http', 'stdio'] as const).map(t => (
                        <button key={t} onClick={() => setTransport(t)}
                          className={`text-[11px] font-mono uppercase tracking-[0.14em] px-3 py-2 transition-colors ${transport === t ? 'bg-aeon-red text-white' : 'text-primary-40 hover:text-primary-70'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {transport === 'http' ? (
                    <>
                      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://mcp.example.com/v1" className={inputCls} />
                      <input value={secretVar} onChange={e => setSecretVar(e.target.value)} placeholder="bearer-token secret name (optional, e.g. ACME_API_KEY)" className={inputCls} />
                    </>
                  ) : (
                    <>
                      <input value={command} onChange={e => setCommand(e.target.value)} placeholder="command (e.g. npx)" className={inputCls} />
                      <input value={args} onChange={e => setArgs(e.target.value)} placeholder="args, space-separated (e.g. -y @modelcontextprotocol/server-sequential-thinking)" className={inputCls} />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button onClick={addServer} className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity">Add server</button>
                    <button onClick={resetForm} className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors">+ Add server</button>
              )}
            </div>

            {/* Footer: secrets reminder + save */}
            {allRefs.length > 0 && (
              <p className="mt-5 text-[11px] text-primary-40 leading-relaxed">
                <span className="text-eva-orange">Secrets:</span> set {allRefs.map(r => <span key={r} className="font-mono text-primary-70">{r} </span>)}
                in <span className="text-primary-70">Settings</span>, and map each into the workflow&apos;s <span className="font-mono">env:</span> block
                (see README → MCP). Until then, runs skip MCP rather than fail.
              </p>
            )}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] font-mono text-primary-35">writes .mcp.json — then Push to commit</span>
              <div className="flex items-center gap-2">
                {dirty && <button onClick={() => setDraft(servers)} className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70 transition-colors">Revert</button>}
                <button onClick={() => onSave(draft)} disabled={!dirty || saving}
                  className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
