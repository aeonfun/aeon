'use client'

import { useState } from 'react'
import { inputCls } from '../lib/utils'

// Grok Build harness auth. Two ways in:
//  - "Connect X account": one-click OAuth (runs `grok login --device-auth`, opens
//    the browser, captures ~/.grok/auth.json → GROK_CREDENTIALS). Parallels the
//    Claude subscription one-click.
//  - Paste an xAI API key (xai-…) → stored as XAI_API_KEY.
// Both post to /api/grok-auth.
interface GrokAuthModalProps {
  loading: boolean
  onClose: () => void
  onGrokAuth: (payload?: { key: string }) => void
}

export function GrokAuthModal({ loading, onClose, onGrokAuth }: GrokAuthModalProps) {
  const [key, setKey] = useState('')
  const submitKey = () => key.trim() && onGrokAuth({ key: key.trim() })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-aeon-panel border border-[rgba(250,250,250,0.10)] w-full max-w-sm mx-4 p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-center justify-between mb-[var(--space-sm)]">
          <h2 className="font-display text-xl">xAI</h2>
          <button onClick={onClose} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
        </div>
        <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">Run skills with the grok CLI on your X account. Click below: a browser tab opens to approve on <code className="text-primary-70">accounts.x.ai</code>, and the session is stored for CI. Needs SuperGrok / X Premium+ and the <code className="text-primary-70">grok</code> CLI installed.</p>
        <button onClick={() => onGrokAuth()} disabled={loading} className="w-full bg-aeon-fg text-aeon-bg text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? '...' : 'Connect X account'}
        </button>
        <div className="my-[var(--space-md)] border-t border-[rgba(250,250,250,0.10)]" />
        <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">Or use an xAI API key (no browser flow) - also powers the Grok gateway.</p>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitKey()} placeholder="xai-..." className={`${inputCls} mb-[var(--space-md)]`} />
        <button onClick={submitKey} disabled={!key.trim() || loading} className="w-full bg-aeon-panel text-aeon-fg border border-[rgba(250,250,250,0.14)] text-sm py-3 font-mono uppercase tracking-[2px] hover:border-aeon-red transition-colors disabled:opacity-50">{loading ? '...' : 'Save xAI Key'}</button>
      </div>
    </div>
  )
}
