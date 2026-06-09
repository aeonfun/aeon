'use client'

import { useState } from 'react'
import { inputCls } from '../lib/utils'

// Gateway providers selectable in the picker. Auto-detect covers keys with a
// distinctive prefix (Anthropic, Bankr bk_, OpenRouter sk-or-, Surplus inf_);
// Venice and UsePod have no prefix so they must be selected explicitly.
const PROVIDER_OPTIONS = [
  { value: '', label: 'Auto-detect (Anthropic / Bankr / OpenRouter / Surplus)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'usepod', label: 'UsePod' },
  { value: 'venice', label: 'Venice' },
  { value: 'surplus', label: 'Surplus Intelligence' },
]

interface AuthModalProps {
  loading: boolean
  onClose: () => void
  onAuth: (payload?: { key: string, baseUrl?: string, provider?: string }) => void
}

export function AuthModal({ loading, onClose, onAuth }: AuthModalProps) {
  const [authKey, setAuthKey] = useState('')
  const [provider, setProvider] = useState('')
  const submit = () => authKey.trim() && onAuth({ key: authKey.trim(), ...(provider ? { provider } : {}) })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-aeon-panel border border-[rgba(250,250,250,0.10)] w-full max-w-sm mx-4 p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-center justify-between mb-[var(--space-sm)]">
          <h2 className="font-display text-xl">Authenticate</h2>
          <button onClick={onClose} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
        </div>
        <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">Connect a Claude subscription token, or paste an Anthropic or Anthropic-compatible API key. Gateway keys with a prefix (Bankr bk_…, OpenRouter sk-or-…, Surplus inf_…) route automatically — pick Venice or UsePod explicitly.</p>
        <button onClick={() => onAuth()} disabled={loading} className="w-full bg-aeon-fg text-aeon-bg text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? '...' : 'Use Claude Subscription'}
        </button>
        <div className="my-[var(--space-md)] border-t border-[rgba(250,250,250,0.10)]" />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full bg-aeon-bg text-aeon-fg text-xs px-3 py-2 border border-[rgba(250,250,250,0.10)] outline-none font-mono cursor-pointer hover:border-[rgba(250,250,250,0.22)] focus:border-aeon-red transition-colors mb-[var(--space-md)]"
        >
          {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="password" value={authKey} onChange={(e) => setAuthKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="API key" className={`${inputCls} mb-[var(--space-md)]`} />
        <button onClick={submit} disabled={!authKey.trim() || loading} className="w-full bg-aeon-panel text-aeon-fg border border-[rgba(250,250,250,0.14)] text-sm py-3 font-mono uppercase tracking-[2px] hover:border-eva-orange transition-colors disabled:opacity-50">{loading ? '...' : 'Save API Key'}</button>
      </div>
    </div>
  )
}
