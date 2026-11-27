'use client'

import { useState, useEffect } from 'react'
import { isRecord } from '../lib/utils'
import { ActionButton, Field } from './glass/connect/ui'
import { ExternalLink, HINT, INLINE_CODE, StatusNote } from './glass/connect/forms'
import type { TelegramStatus } from '../lib/types'

interface TelegramChatIdHelperProps {
  // Bot token saved earlier in this session - secrets are write-only on GitHub,
  // so this is the only chance to pre-fill and save the operator a second paste.
  defaultToken?: string
  onFound: (chatId: string) => void
}

// Minimal slice of the getUpdates payload - any update type carrying a chat id works.
interface TgUpdate {
  message?: { chat?: { id?: number } }
  edited_message?: { chat?: { id?: number } }
  channel_post?: { chat?: { id?: number } }
  my_chat_member?: { chat?: { id?: number } }
}

export function TelegramChatIdHelper({ defaultToken, onFound }: TelegramChatIdHelperProps) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<TelegramStatus | null>(null)

  useEffect(() => {
    if (defaultToken) setToken(defaultToken)
  }, [defaultToken])

  const trimmed = token.trim()
  const getUpdatesUrl = trimmed ? `https://api.telegram.org/bot${trimmed}/getUpdates` : null

  const chatIdFrom = (u: TgUpdate) =>
    u.message?.chat?.id ?? u.edited_message?.chat?.id ?? u.channel_post?.chat?.id ?? u.my_chat_member?.chat?.id

  const findChatId = async () => {
    if (!getUpdatesUrl) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(getUpdatesUrl)
      const data: unknown = await res.json()
      if (!isRecord(data) || data.ok !== true) {
        const msg =
          isRecord(data) && typeof data.description === 'string'
            ? data.description
            : 'Telegram rejected the token - double-check it.'
        setStatus({ ok: false, msg })
        return
      }
      // Latest update wins - scan backwards for anything with a chat id.
      const updates: TgUpdate[] = Array.isArray(data.result) ? (data.result as TgUpdate[]) : []
      for (let i = updates.length - 1; i >= 0; i--) {
        const id = chatIdFrom(updates[i])
        if (id !== undefined) {
          onFound(String(id))
          setStatus({ ok: true, msg: `Found chat ID ${id}. It is filled in below: press Save.` })
          return
        }
      }
      setStatus({ ok: false, msg: 'No messages yet - open your bot in Telegram, send it anything, then fetch again.' })
    } catch {
      setStatus({ ok: false, msg: 'Could not reach api.telegram.org from the browser - use the open link instead.' })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div>
        <ActionButton
          onClick={() => setOpen(true)}
          title="Paste your bot token and Aeon reads your chat ID from Telegram's getUpdates API"
        >
          Find my chat ID
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </ActionButton>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-[18px] bg-[rgb(255_255_255/0.5)] p-4 shadow-[inset_0_0_0_1px_var(--line)]">
      <p className={HINT}>
        Send your bot any message in Telegram first (it can&apos;t see you until you do), then paste its token: the chat
        ID is read from <code className={INLINE_CODE}>getUpdates</code>. The token stays in your browser; nothing is
        stored.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Field
          label="Bot token"
          hideLabel
          className="min-w-0 flex-1"
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && findChatId()}
          placeholder="Paste the bot token"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <ActionButton onClick={findChatId} disabled={!trimmed || busy} className="h-12 flex-1 sm:flex-none">
            {busy ? 'Fetching' : 'Fetch'}
          </ActionButton>
          <ActionButton
            onClick={() => {
              setOpen(false)
              setStatus(null)
            }}
            className="h-12"
          >
            Cancel
          </ActionButton>
        </div>
      </div>
      {status && <StatusNote tone={status.ok ? 'ok' : 'error'}>{status.msg}</StatusNote>}
      {getUpdatesUrl && (
        <p className={HINT}>
          <ExternalLink
            href={getUpdatesUrl}
            title={
              'Opens getUpdates for your bot in a new tab - look for "chat":{"id":...} in the JSON. Empty result? Message your bot first.'
            }
          >
            Or open getUpdates in a new tab
          </ExternalLink>
        </p>
      )}
    </div>
  )
}
