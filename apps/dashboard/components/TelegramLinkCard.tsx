'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { ActionButton, Field, LINK, TAG } from './glass/connect/ui'
import { HINT, QUIET_TAG, StatusNote } from './glass/connect/forms'
import { postJson } from '../lib/api-client'

// Sets TELEGRAM_CHAT_ID without copy-paste: show a t.me deep link with a
// one-time code, the operator taps it (Telegram sends "/start <code>"), and the
// server spots that message in getUpdates and saves the chat id. Falls back to
// the manual TelegramChatIdHelper (on the TELEGRAM_CHAT_ID row) when the bot is in webhook mode (409).
// Server side: app/api/telegram/link (+ /check), lib/telegram-link.ts.

interface TelegramLinkCardProps {
  // Bot token saved earlier in this session (secrets are write-only on GitHub).
  sessionBotToken: string
  chatIdSet: boolean
  onLinked: (chatId: string) => void
}

const POLL_MS = 3000
const MAX_POLLS = 300 // 15 minutes, the nonce's lifetime

export function TelegramLinkCard({ sessionBotToken, chatIdSet, onLinked }: TelegramLinkCardProps) {
  const [token, setToken] = useState('')
  const [link, setLink] = useState<{ username: string; nonce: string; link: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'waiting' | 'found' | 'webhook' | 'backlog' | 'error'>(
    'idle',
  )
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const onLinkedRef = useRef(onLinked)
  useEffect(() => {
    onLinkedRef.current = onLinked
  })

  const botToken = (token || sessionBotToken).trim()

  const start = async () => {
    setStatus('starting')
    setMsg('')
    const { ok, data } = await postJson<{ username?: string; nonce?: string; link?: string; error?: string }>(
      '/api/telegram/link',
      { token: botToken },
    )
    if (!ok || !data.link || !data.nonce || !data.username) {
      setStatus('error')
      setMsg(data.error || 'Telegram rejected the token.')
      return
    }
    setLink({ username: data.username, nonce: data.nonce, link: data.link })
    setStatus('waiting')
  }

  // Poll for the /start message while waiting.
  useEffect(() => {
    if (status !== 'waiting' || !link) return
    let stopped = false
    let polls = 0
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (stopped) return
      const { ok, data } = await postJson<{ status?: string; chatId?: string; error?: string }>(
        '/api/telegram/link/check',
        { token: botToken, nonce: link.nonce },
      )
      if (stopped) return
      if (ok && data.status === 'found' && data.chatId) {
        setStatus('found')
        setMsg(`Linked chat ${data.chatId}. Saved as TELEGRAM_CHAT_ID.`)
        onLinkedRef.current(data.chatId)
        return
      }
      if (ok && data.status === 'webhook') {
        setStatus('webhook')
        return
      }
      if (ok && data.status === 'backlog') {
        setStatus('backlog')
        return
      }
      if (ok && data.status === 'expired') {
        setStatus('error')
        setMsg('That link expired. Start again.')
        return
      }
      if (!ok) {
        setStatus('error')
        setMsg(data.error || 'Could not check Telegram.')
        return
      }
      if (++polls >= MAX_POLLS) {
        setStatus('error')
        setMsg('No /start seen yet. Start again.')
        return
      }
      timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [status, link, botToken])

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="px-3 py-4 sm:pl-[calc(22px+1.75rem)]">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium">Link your chat</span>
        {chatIdSet && status !== 'found' && <span className={cn(TAG, QUIET_TAG)}>Already set, relink to change</span>}
      </p>
      {status === 'idle' || status === 'starting' || status === 'error' ? (
        <>
          <p className={cn(HINT, 'mt-1 max-w-[78ch]')}>
            Skip finding the chat ID by hand: get a link, tap it, press Start, done.
            {!sessionBotToken &&
              ' Paste the bot token once more (GitHub secrets cannot be read back); it is only used for this and not stored.'}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {!sessionBotToken && (
              <Field
                label="Bot token"
                hideLabel
                className="min-w-0 flex-1"
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && botToken && start()}
                placeholder="Bot token (123456789:AA...)"
                autoComplete="off"
              />
            )}
            <ActionButton
              onClick={start}
              disabled={!botToken || status === 'starting'}
              className="h-12 shrink-0 self-start sm:self-auto"
            >
              {status === 'starting' ? 'Getting the link' : 'Get my link'}
            </ActionButton>
          </div>
          {status === 'error' && (
            <StatusNote tone="error" className="mt-2">
              {msg}
            </StatusNote>
          )}
        </>
      ) : status === 'waiting' && link ? (
        <div className="mt-2 space-y-3">
          <p className={HINT}>
            Open this on the phone or computer where you use Telegram and press{' '}
            <strong className="font-medium text-foreground">Start</strong>:
          </p>
          <div className="g-chip flex min-h-12 items-center gap-2 rounded-[18px] py-1.5 pr-1.5 pl-4">
            <a
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(LINK, 'min-w-0 flex-1 py-1.5 font-mono text-[13px] [overflow-wrap:anywhere]')}
            >
              {link.link}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <ActionButton onClick={copy} className="h-9 shrink-0 px-3.5 text-[13px]">
              {copied ? 'Copied' : 'Copy'}
            </ActionButton>
          </div>
          <StatusNote tone="busy">Waiting for /start from @{link.username}</StatusNote>
        </div>
      ) : status === 'found' ? (
        <StatusNote tone="ok" className="mt-2">
          {msg}
        </StatusNote>
      ) : status === 'backlog' ? (
        <div className="mt-2 space-y-3">
          <StatusNote tone="error">
            This bot has 100+ old updates waiting, so Aeon cannot see your new /start. Paste the chat id yourself with
            Find my chat ID under TELEGRAM_CHAT_ID above, or clear the bot&apos;s old updates and try again.
          </StatusNote>
          <ActionButton onClick={() => setStatus('idle')}>Try again</ActionButton>
        </div>
      ) : (
        <StatusNote tone="error" className="mt-2">
          This bot uses a webhook (instant replies), so Aeon cannot read its messages here. Use Find my chat ID under
          TELEGRAM_CHAT_ID above instead.
        </StatusNote>
      )}
    </div>
  )
}
