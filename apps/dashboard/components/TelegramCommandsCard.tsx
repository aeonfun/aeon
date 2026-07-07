'use client'

import { useState } from 'react'
import type { TelegramStatus } from '../lib/types'

interface TelegramCommandsCardProps {
  // Whether TELEGRAM_BOT_TOKEN is set. The workflow reads the token server-side, so
  // re-registering only makes sense once it exists — the button is disabled until then.
  tokenSet: boolean
}

// A row inside the Telegram credentials list. Slash commands register automatically
// the moment the bot token is saved (POST /api/secrets dispatches the workflow), and
// again whenever aeon.yml changes on main — so this is just a manual "re-sync after
// toggling skills" button. It POSTs to /api/telegram/commands, which dispatches the
// Setup Telegram Commands workflow (reads the stored TELEGRAM_BOT_TOKEN server-side and
// calls setMyCommands + setChatMenuButton). No token pasting.
export function TelegramCommandsCard({ tokenSet }: TelegramCommandsCardProps) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<TelegramStatus | null>(null)

  const register = async () => {
    if (!tokenSet || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/telegram/commands', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setStatus({ ok: false, msg: data.error || 'Could not start the registration workflow.' })
        return
      }
      setStatus({ ok: true, msg: 'Registering… the workflow is running in GitHub Actions; your / menu updates in ~30s.' })
    } catch {
      setStatus({ ok: false, msg: 'Could not reach the dashboard API.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">⌘ Slash commands</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-35">auto</span>
          </div>
          <div className="text-[11px] text-primary-40 font-mono mt-1">
            Enabled skills become Telegram <span className="text-primary-70">/</span> commands - then{' '}
            <span className="text-primary-70">/skillname</span> runs instantly, no LLM call.
          </div>
          {status && (
            <p className={`text-[11px] font-mono mt-2 ${status.ok ? 'text-eva-green' : 'text-eva-red/80'}`}>{status.msg}</p>
          )}
        </div>
        <button
          onClick={register}
          disabled={!tokenSet || busy}
          title={tokenSet
            ? 'Runs the Setup Telegram Commands workflow - reuses the stored bot token server-side, no pasting.'
            : 'Set TELEGRAM_BOT_TOKEN first; commands register automatically once it is saved.'}
          className="text-[11px] text-aeon-bg bg-aeon-fg font-mono px-2.5 py-1 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {busy ? 'Registering…' : 'Register again'}
        </button>
      </div>
    </div>
  )
}
