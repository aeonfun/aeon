'use client'

import { useState } from 'react'
import { inputCls } from '../lib/utils'
import { HARNESS_AUTH } from '../lib/harness-auth'

// Native auth for the run-harness harnesses (codex/pi/vibe/kimi) — the generic
// parallel to GrokAuthModal. codex/kimi offer a one-click native login (browser/
// device OAuth, captured for CI); every one of the four also takes a provider
// API key, and all fall back to the shared OpenRouter key. Posts to
// /api/harness-auth via onHarnessAuth (no arg = OAuth, {key} = provider key).

const TITLES: Record<string, string> = { codex: 'Codex', kimi: 'Kimi', pi: 'Pi', vibe: 'Vibe' }
const OAUTH_BLURB: Record<string, string> = {
  codex: 'Run codex on your ChatGPT plan. A browser tab opens to approve on OpenAI; the session is captured for CI. Needs the codex CLI installed.',
  kimi: 'Run kimi on your Moonshot account (device-code flow). A browser tab opens to approve; the session is captured for CI. Needs the kimi CLI installed.',
}

interface HarnessAuthModalProps {
  harness: string
  loading: boolean
  onClose: () => void
  onHarnessAuth: (payload?: { key: string }) => void
}

export function HarnessAuthModal({ harness, loading, onClose, onHarnessAuth }: HarnessAuthModalProps) {
  const spec = HARNESS_AUTH[harness]
  const [key, setKey] = useState('')
  const submitKey = () => key.trim() && onHarnessAuth({ key: key.trim() })
  if (!spec) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-aeon-panel border border-[rgba(250,250,250,0.10)] w-full max-w-sm mx-4 p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-center justify-between mb-[var(--space-sm)]">
          <h2 className="font-display text-xl">{TITLES[harness] ?? harness}</h2>
          <button onClick={onClose} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
        </div>

        {spec.oauth && (
          <>
            <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">{OAUTH_BLURB[harness] ?? 'Connect this harness with its native login.'}</p>
            <button onClick={() => onHarnessAuth()} disabled={loading} className="w-full bg-aeon-fg text-aeon-bg text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? '...' : spec.oauth.label}
            </button>
          </>
        )}

        {spec.apiKey && (
          <>
            {spec.oauth && <div className="my-[var(--space-md)] border-t border-[rgba(250,250,250,0.10)]" />}
            <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">{spec.oauth ? 'Or use a provider API key (no browser flow).' : 'Paste a provider API key.'} Any of the four also runs on the shared OpenRouter key.</p>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitKey()} placeholder={spec.apiKey.placeholder} className={`${inputCls} mb-[var(--space-md)]`} />
            <button onClick={submitKey} disabled={!key.trim() || loading} className="w-full bg-aeon-panel text-aeon-fg border border-[rgba(250,250,250,0.14)] text-sm py-3 font-mono uppercase tracking-[2px] hover:border-aeon-red transition-colors disabled:opacity-50">{loading ? '...' : 'Save key'}</button>
          </>
        )}
      </div>
    </div>
  )
}
