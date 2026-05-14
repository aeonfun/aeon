import type { Skill } from '../lib/types'
import { MODELS, BANKR_EXTRA_MODELS, DEPARTMENTS } from '../lib/constants'
import { displayName } from '../lib/utils'

interface TopBarProps {
  skill: Skill | null
  view: 'hq' | 'secrets'
  repo: string
  model: string
  gateway: 'direct' | 'bankr'
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
    <div className="h-12 border-b-2 border-[rgba(10,10,10,0.06)] flex items-center justify-between px-5 shrink-0 bg-white">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg">{skill ? displayName(skill.name) : view === 'secrets' ? 'Settings' : `${repo ? repo.split('/').pop() : 'Aeon'} HQ`}</span>
        {skill && dept && <span className="text-[11px] font-mono px-2 py-0.5" style={{ backgroundColor: dept.color + '15', color: dept.color }}>{dept.label}</span>}
      </div>
      <div className="flex items-center gap-2">
        {gateway === 'bankr' && <span className="text-[11px] font-mono px-2 py-0.5 bg-eva-orange/15 text-eva-orange uppercase tracking-[1px]">Bankr</span>}
        {authStatus && !authStatus.authenticated && <button onClick={onSetupAuth} disabled={authLoading} className="bg-eva-orange text-white text-[11px] px-3 py-1.5 font-mono uppercase tracking-[1px] hover:opacity-90 transition-opacity disabled:opacity-50">{authLoading ? '...' : 'Auth'}</button>}
        <select value={model} onChange={(e) => onUpdateModel(e.target.value)} className="bg-white text-primary-70 text-[11px] px-2.5 py-1.5 border-2 border-[rgba(10,10,10,0.08)] outline-none cursor-pointer font-mono">
          {modelOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button onClick={onShowImport} className="bg-eva-black text-white text-[11px] px-3 py-1.5 font-mono uppercase tracking-[1px] hover:opacity-90 transition-opacity">+ Hire</button>
        {repo && <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-40 font-mono border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-eva-orange hover:text-eva-orange transition-colors">GitHub</a>}
        <button onClick={onPull} disabled={pulling} className="relative text-[11px] font-mono text-primary-40 border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-[rgba(10,10,10,0.2)] transition-colors disabled:opacity-50">
          {behind > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-eva-orange" />}
          {pulling ? '...' : 'Pull'}
        </button>
        <button onClick={onSync} disabled={syncing || !hasChanges} className="relative text-[11px] font-mono text-primary-40 border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-[rgba(10,10,10,0.2)] transition-colors disabled:opacity-50">
          {hasChanges && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-eva-green" />}
          {syncing ? '...' : 'Push'}
        </button>
      </div>
    </div>
  )
}
