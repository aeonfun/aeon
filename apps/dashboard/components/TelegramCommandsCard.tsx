'use client'

import { useState } from 'react'
import type { TelegramStatus } from '../lib/types'
import { withBase } from '@/lib/base-path'
import { cn } from '@/lib/cn'
import { ActionButton, TAG } from './glass/connect/ui'
import { HINT, QUIET_TAG, INLINE_CODE, StatusNote } from './glass/connect/forms'

interface TelegramCommandsCardProps {
  // Whether TELEGRAM_BOT_TOKEN is set. The workflow reads the token server-side, so
  // re-registering only makes sense once it exists - the button is disabled until then.
  tokenSet: boolean
}

// A row inside the Telegram credentials list. Slash commands register automatically
// the moment the bot token is saved (POST /api/secrets dispatches the workflow), and
// again whenever aeon.yml changes on main - so this is just a manual "re-sync after
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
      const res = await fetch(withBase('/api/telegram/commands'), { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setStatus({ ok: false, msg: data.error || 'Could not start the registration workflow.' })
        return
      }
      setStatus({
        ok: true,
        msg: 'Registering. The workflow is running in GitHub Actions; your / menu updates in about 30 seconds.',
      })
    } catch {
      setStatus({ ok: false, msg: 'Could not reach the dashboard API.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-3 py-4 sm:pl-[calc(22px+1.75rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">Slash commands</span>
            <span className={cn(TAG, QUIET_TAG)}>Automatic</span>
          </p>
          <p className={cn(HINT, 'mt-1 max-w-[78ch]')}>
            Enabled skills become Telegram <code className={INLINE_CODE}>/</code> commands, so{' '}
            <code className={INLINE_CODE}>/skillname</code> runs at once with no model call. They register when the bot
            token is saved; register again after enabling or disabling skills.
          </p>
        </div>
        <ActionButton
          onClick={register}
          disabled={!tokenSet || busy}
          title={
            tokenSet
              ? 'Runs the Setup Telegram Commands workflow - reuses the stored bot token server-side, no pasting.'
              : 'Set TELEGRAM_BOT_TOKEN first; commands register automatically once it is saved.'
          }
          className="self-start sm:self-auto"
        >
          {busy ? 'Registering' : 'Register again'}
        </ActionButton>
      </div>
      {status && (
        <StatusNote tone={status.ok ? 'ok' : 'error'} className="mt-3">
          {status.msg}
        </StatusNote>
      )}
    </div>
  )
}
