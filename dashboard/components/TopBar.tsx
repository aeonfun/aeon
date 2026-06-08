import type { Skill, GatewayProvider } from '../lib/types'
import { MODELS, BANKR_EXTRA_MODELS, DEPARTMENTS } from '../lib/constants'
import { displayName } from '../lib/utils'

interface TopBarProps {
  skill: Skill | null
  view: 'hq' | 'secrets' | 'strategy' | 'mcp'
  repo: string
  model: string
  gateway: GatewayProvider
  authStatus: { authenticated: boolean } | null
  authLoading: boolean
  pulling: boolean
  syncing: boolean
  hasChanges: boolean
  behind: number
  onSetupAuth: () => void
  onUpdateModel: (m: string) => void
  onShowImport: () => void
  onPull: () => void
  onSync: () => void
}

export function TopBar({ skill, view, repo, model, gateway, authStatus, authLoading, pulling, syncing, hasChanges, behind, onSetupAuth, onUpdateModel, onShowImport, onPull, onSync }: TopBarProps) {
  const dept = skill?.tags?.[0] ? DEPARTMENTS[skill.tags[0]] : null
  const modelOptions = gateway === 'bankr' ? [...MODELS, ...BANKR_EXTRA_MODELS] : MODELS

  return (
    <div className="h-14 border-b border-[rgba(250,250,250,0.10)] flex items-center justify-between px-5 shrink-0 bg-aeon-bg">
      <div className="flex items-center gap-3">
        <span className="font-display text-lg uppercase tracking-wide text-aeon-fg">
          {skill ? displayName(skill.name) : view === 'secrets' ? 'Settings' : view === 'strategy' ? 'Strategy' : view === 'mcp' ? 'MCP' : `${repo ? repo.split('/').pop() : 'Aeon'} HQ`}
        </span>
        {skill && dept && (
          <span
            className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 border"
            style={{ borderColor: dept.color + '40', color: dept.color, backgroundColor: dept.color + '12' }}
          >
            {dept.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {gateway === 'bankr' && (
          <span className="text-[10px] font-mono px-2 py-0.5 bg-aeon-red/10 text-eva-orange uppercase tracking-[0.18em] border border-aeon-red/30">Bankr</span>
        )}
        {authStatus && !authStatus.authenticated && (
          <button onClick={onSetupAuth} disabled={authLoading} className="btn-solid-sm disabled:opacity-50">
            {authLoading ? '…' : 'Auth'}
          </button>
        )}
        <select
          value={model}
          onChange={(e) => onUpdateModel(e.target.value)}
          className="bg-aeon-panel text-primary-70 text-[11px] font-mono uppercase tracking-[0.14em] px-3 h-[32px] border border-[rgba(250,250,250,0.10)] outline-none cursor-pointer hover:border-[rgba(250,250,250,0.22)] transition-colors"
        >
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id} className="bg-aeon-panel text-aeon-fg">{m.label}</option>
          ))}
        </select>
        <button onClick={onShowImport} className="btn-ghost-sm">+ Hire</button>
        {repo && (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-quiet"
          >
            GitHub
          </a>
        )}
        <button onClick={onPull} disabled={pulling} className="btn-quiet disabled:opacity-50">
          {behind > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-aeon-red animate-pulse" />}
          {pulling ? '…' : 'Pull'}
        </button>
        <button onClick={onSync} disabled={syncing || !hasChanges} className="btn-quiet disabled:opacity-40">
          {hasChanges && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-aeon-green" />}
          {syncing ? '…' : 'Push'}
        </button>
      </div>
    </div>
  )
}
