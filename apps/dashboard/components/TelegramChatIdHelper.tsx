'use client'

import { useState, useEffect } from 'react'
import { inputCls } from '../lib/utils'

interface TelegramChatIdHelperProps {
  // Bot token saved earlier in this session — secrets are write-only on GitHub,
  // so this is the only chance to pre-fill and save the operator a second paste.
  defaultToken?: string
  onFound: (chatId: string) => void
}

// Minimal slice of the getUpdates payload — any update type carrying a chat id works.
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
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { if (defaultToken) setToken(defaultToken) }, [defaultToken])

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
      const data = await res.json() as { ok: boolean; description?: string; result?: TgUpdate[] }
      if (!data.ok) {
        setStatus({ ok: false, msg: data.description ?? 'Telegram rejected the token — double-check it.' })
        return
      }
      // Latest update wins — scan backwards for anything with a chat id.
      const updates = data.result ?? []
      for (let i = updates.length - 1; i >= 0; i--) {
        const id = chatIdFrom(updates[i])
        if (id !== undefined) {
          onFound(String(id))
          setStatus({ ok: true, msg: `Found chat ID ${id} — filled in above, hit Save.` })
          return
        }
      }
      setStatus({ ok: false, msg: 'No messages yet — open your bot in Telegram, send it anything, then fetch again.' })
    } catch {
      setStatus({ ok: false, msg: 'Could not reach api.telegram.org from the browser — use the open link instead.' })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Paste your bot token and Aeon reads your chat ID from Telegram's getUpdates API"
        className="text-[10px] font-mono text-eva-orange/80 hover:text-eva-orange transition-colors mt-1"
      >
        Find my chat ID →
      </button>
    )
  }

  return (
    <div className="mt-2 border border-[rgba(250,250,250,0.10)] bg-aeon-bg/40 p-3 space-y-2">
      <p className="text-[11px] text-primary-40 leading-relaxed">
        Send your bot any message in Telegram first (it can&apos;t see you until you do), then paste
        its token — the chat ID is read from <span className="font-mono text-primary-70">getUpdates</span>.
        The token stays in your browser; nothing is stored.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && findChatId()}
          placeholder="paste bot token..."
          className={inputCls}
        />
        <button
          onClick={findChatId}
          disabled={!trimmed || busy}
          className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {busy ? 'Fetching…' : 'Fetch'}
        </button>
        <button
          onClick={() => { setOpen(false); setStatus(null) }}
          className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70 shrink-0"
        >
          Cancel
        </button>
      </div>
      {status && (
        <p className={`text-[11px] font-mono ${status.ok ? 'text-eva-green' : 'text-eva-red/80'}`}>{status.msg}</p>
      )}
      {getUpdatesUrl && (
        <a
          href={getUpdatesUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={'Opens getUpdates for your bot in a new tab — look for "chat":{"id":...} in the JSON. Empty result? Message your bot first.'}
          className="inline-block text-[10px] font-mono text-primary-40 hover:text-eva-orange transition-colors"
        >
          or open getUpdates in a new tab ↗
        </a>
      )}
    </div>
  )
}
