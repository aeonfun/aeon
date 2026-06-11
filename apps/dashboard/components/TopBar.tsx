import type { Skill, GatewayProvider } from '../lib/types'
import { MODELS, CATEGORY_BY_KEY } from '../lib/constants'
import { displayName } from '../lib/utils'

interface TopBarProps {
  skill: Skill | null
  view: 'hq' | 'secrets' | 'strategy' | 'mcp' | 'soul'
  repo: string
  model: string
  gateway: GatewayProvider
  hasModelKey: boolean
  authLoading: boolean
  pulling: boolean
  syncing: boolean
  hasChanges: boolean
  behind: number
  onSetupAuth: () => void
  onUpdateModel: (m: string) => void
  onPull: () => void
  onSync: () => void
}

export function TopBar({ skill, view, repo, model, gateway, hasModelKey, authLoading, pulling, syncing, hasChanges, behind, onSetupAuth, onUpdateModel, onPull, onSync }: TopBarProps) {
  const dept = skill ? (CATEGORY_BY_KEY[skill.category || 'meta'] || null) : null
  const modelOptions = MODELS

  return (
    <div className="h-14 border-b border-[rgba(250,250,250,0.10)] flex items-center justify-between px-5 shrink-0 bg-aeon-bg">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="font-display text-lg uppercase tracking-wide text-aeon-fg truncate">
          {skill ? displayName(skill.name) : view === 'secrets' ? 'Settings' : view === 'strategy' ? 'Strategy' : view === 'mcp' ? 'MCP' : view === 'soul' ? 'Soul' : `${repo ? repo.split('/').pop() : 'Aeon'} HQ`}
        </span>
        {skill && dept && (
          <span
            className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-1 border shrink-0 text-center leading-[1.15] max-w-[140px] break-words"
            style={{ borderColor: dept.color + '40', color: dept.color, backgroundColor: dept.color + '12' }}
          >
            {dept.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {gateway !== 'direct' && gateway !== 'auto' && (
          <span className="text-[10px] font-mono px-2 py-0.5 bg-aeon-red/10 text-eva-orange uppercase tracking-[0.18em] border border-aeon-red/30">{gateway}</span>
        )}
        {!hasModelKey && (
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
        {repo && (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            title="GitHub"
            className="btn-quiet flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.61 8.21 11.17.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.01 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.22.69.83.57C20.57 21.9 24 17.49 24 12.29 24 5.78 18.63.5 12 .5z"/>
            </svg>
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
