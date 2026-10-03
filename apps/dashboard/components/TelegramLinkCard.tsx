'use client'

import { useEffect, useRef, useState } from 'react'
import { inputCls } from '../lib/utils'
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
  const [status, setStatus] = useState<'idle' | 'starting' | 'waiting' | 'found' | 'webhook' | 'backlog' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const onLinkedRef = useRef(onLinked)
  useEffect(() => { onLinkedRef.current = onLinked })

  const botToken = (token || sessionBotToken).trim()

  const start = async () => {
    setStatus('starting'); setMsg('')
    const { ok, data } = await postJson<{ username?: string; nonce?: string; link?: string; error?: string }>('/api/telegram/link', { token: botToken })
    if (!ok || !data.link || !data.nonce || !data.username) { setStatus('error'); setMsg(data.error || 'Telegram rejected the token.'); return }
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
      const { ok, data } = await postJson<{ status?: string; chatId?: string; error?: string }>('/api/telegram/link/check', { token: botToken, nonce: link.nonce })
      if (stopped) return
      if (ok && data.status === 'found' && data.chatId) { setStatus('found'); setMsg(`Linked chat ${data.chatId}. Saved as TELEGRAM_CHAT_ID.`); onLinkedRef.current(data.chatId); return }
      if (ok && data.status === 'webhook') { setStatus('webhook'); return }
      if (ok && data.status === 'backlog') { setStatus('backlog'); return }
      if (ok && data.status === 'expired') { setStatus('error'); setMsg('That link expired. Start again.'); return }
      if (!ok) { setStatus('error'); setMsg(data.error || 'Could not check Telegram.'); return }
      if (++polls >= MAX_POLLS) { setStatus('error'); setMsg('No /start seen yet. Start again.'); return }
      timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    return () => { stopped = true; clearTimeout(timer) }
  }, [status, link, botToken])

  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link.link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-1">Link your chat {chatIdSet && status !== 'found' ? '(already set - relink to change)' : ''}</div>
      {status === 'idle' || status === 'starting' || status === 'error' ? (
        <>
          <p className="text-[11px] text-primary-40 leading-relaxed mb-2">
            Skip finding the chat ID by hand: get a link, tap it, press Start, done.
            {!sessionBotToken && ' Paste the bot token once more (GitHub secrets cannot be read back); it is only used for this and not stored.'}
          </p>
          <div className="flex gap-2">
            {!sessionBotToken && (
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="bot token (123456789:AA...)" className={inputCls} />
            )}
            <button onClick={start} disabled={!botToken || status === 'starting'} className="btn-mini-go shrink-0">{status === 'starting' ? '...' : 'Get my link'}</button>
          </div>
          {status === 'error' && <p className="text-[11px] font-mono text-aeon-red-alert/80 mt-1.5">{msg}</p>}
        </>
      ) : status === 'waiting' && link ? (
        <div className="space-y-2">
          <p className="text-[11px] text-primary-50 leading-relaxed">Open this on the phone or computer where you use Telegram and press <span className="text-aeon-fg">Start</span>:</p>
          <div className="flex items-stretch border border-[rgba(250,250,250,0.14)] bg-aeon-bg">
            <a href={link.link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 px-3 py-2 text-[11px] font-mono text-aeon-fg break-all hover:text-aeon-red">{link.link}</a>
            <button onClick={copy} className="shrink-0 px-3 border-l border-[rgba(250,250,250,0.14)] text-[10px] font-mono uppercase tracking-[0.14em] text-primary-70 hover:text-aeon-fg">{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="text-[11px] font-mono text-primary-40 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-aeon-red animate-pulse" />Waiting for /start from @{link.username}...</p>
        </div>
      ) : status === 'found' ? (
        <p className="text-[11px] font-mono text-aeon-green">{msg}</p>
      ) : status === 'backlog' ? (
        <div>
          <p className="text-[11px] text-aeon-red/80 leading-relaxed">This bot has 100+ old updates waiting, so Aeon cannot see your new /start. Paste the chat id yourself with <span className="text-aeon-fg">Find my chat ID</span> under TELEGRAM_CHAT_ID above, or clear the bot&apos;s old updates and try again.</p>
          <button onClick={() => setStatus('idle')} className="btn-mini mt-1.5">Try again</button>
        </div>
      ) : (
        <p className="text-[11px] text-aeon-red/80 leading-relaxed">This bot uses a webhook (instant mode), so Aeon cannot read its messages here. Use <span className="text-aeon-fg">Find my chat ID</span> under TELEGRAM_CHAT_ID above instead.</p>
      )}
    </div>
  )
}
