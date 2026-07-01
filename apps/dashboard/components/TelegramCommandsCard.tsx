'use client'

import { useState, useEffect } from 'react'
import { inputCls } from '../lib/utils'
import type { TelegramStatus } from '../lib/types'

interface TelegramCommandsCardProps {
  // Bot token saved earlier in this session - secrets are write-only on GitHub,
  // so this pre-fills the token for the one-click register.
  sessionBotToken?: string
}

// Telegram command names: 1-32 chars, lowercase a-z / 0-9 / _. Mirrors the mapping
// in .github/workflows/setup-commands.yml so the button and the workflow agree.
function cmdName(slug: string): string {
  return slug.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32)
}

// A row inside the Telegram credentials list: pushes the enabled skills to
// Telegram's `/` autocomplete menu in one click, calling setMyCommands straight
// from the browser (Telegram allows CORS - same trick as the webhook helper).
// The token never leaves the page except to api.telegram.org.
export function TelegramCommandsCard({ sessionBotToken }: TelegramCommandsCardProps) {
  const [botToken, setBotToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<TelegramStatus | null>(null)

  useEffect(() => { if (sessionBotToken) setBotToken(sessionBotToken) }, [sessionBotToken])

  const register = async () => {
    const token = botToken.trim()
    if (!token) return
    setBusy(true)
    setStatus(null)
    try {
      // Pull enabled skills + descriptions from the dashboard's own catalog.
      const res = await fetch('/api/skills')
      if (!res.ok) throw new Error('skills')
      const data = await res.json() as { skills?: Array<{ name: string; description?: string; enabled?: boolean }> }

      const reserved = new Set(['start', 'help', 'settings'])
      const commands: Array<{ command: string; description: string }> = [
        { command: 'start', description: 'Introduction and how to run skills' },
        { command: 'help', description: 'How to use Aeon over Telegram' },
        { command: 'settings', description: 'List currently enabled skills' },
      ]
      for (const s of data.skills ?? []) {
        if (!s.enabled) continue
        const c = cmdName(s.name)
        if (!c || reserved.has(c)) continue
        reserved.add(c)
        commands.push({ command: c, description: (s.description || s.name).slice(0, 256) })
      }
      // Telegram caps the list at 100.
      const capped = commands.slice(0, 100)

      // GET with a JSON-encoded query param avoids a CORS preflight (same as the
      // webhook helper's setWebhook GET).
      const setRes = await fetch(
        `https://api.telegram.org/bot${token}/setMyCommands?commands=${encodeURIComponent(JSON.stringify(capped))}`,
      )
      const setData = await setRes.json() as { ok: boolean; description?: string }
      if (!setData.ok) {
        setStatus({ ok: false, msg: setData.description ?? 'Telegram rejected the request - double-check the token.' })
        return
      }
      // Point the message-field menu button at the command list (default type).
      await fetch(
        `https://api.telegram.org/bot${token}/setChatMenuButton?menu_button=${encodeURIComponent(JSON.stringify({ type: 'commands' }))}`,
      )
      const n = capped.length - 3
      setStatus({ ok: true, msg: `Registered ${n} skill command${n === 1 ? '' : 's'} + start/help/settings. Type / in Telegram to see them.` })
    } catch {
      setStatus({ ok: false, msg: 'Could not reach the skills API or api.telegram.org from the browser - run the Setup Telegram Commands workflow instead.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">⌘ Slash commands</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-35">optional</span>
      </div>
      <div className="text-[11px] text-primary-40 font-mono mb-2">
        Push enabled skills to Telegram&apos;s <span className="text-primary-70">/</span> autocomplete menu — then{' '}
        <span className="text-primary-70">/skillname</span> runs instantly, no LLM call.
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && register()}
          placeholder="bot token..."
          className={inputCls}
        />
        <button
          onClick={register}
          disabled={!botToken.trim() || busy}
          className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {busy ? 'Registering…' : 'Register'}
        </button>
      </div>
      <p className="text-[11px] text-primary-35 mt-2">
        Reads your enabled skills; the token only goes to api.telegram.org, nothing is stored. Re-run after toggling skills.
      </p>
      {status && (
        <p className={`text-[11px] font-mono mt-2 ${status.ok ? 'text-eva-green' : 'text-eva-red/80'}`}>{status.msg}</p>
      )}
    </div>
  )
}
