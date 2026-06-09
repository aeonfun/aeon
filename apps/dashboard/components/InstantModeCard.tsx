'use client'

import { useState, useEffect } from 'react'
import { inputCls } from '../lib/utils'

interface InstantModeCardProps {
  repo: string
  // Bot token saved earlier in this session — secrets are write-only on GitHub,
  // so this is the only chance to pre-fill it for the setWebhook step.
  sessionBotToken?: string
}

// Rendered as a row inside the Telegram credentials list: a one-liner with a
// Yes/No choice when collapsed, the full Cloudflare Worker walkthrough when on.
export function InstantModeCard({ repo, sessionBotToken }: InstantModeCardProps) {
  const [enabled, setEnabled] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [workerUrl, setWorkerUrl] = useState('')
  const [whBusy, setWhBusy] = useState(false)
  const [whStatus, setWhStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { if (sessionBotToken) setBotToken(sessionBotToken) }, [sessionBotToken])

  const deployRepo = repo || 'aaronjmars/aeon'
  const deployUrl = `https://deploy.workers.cloudflare.com/?url=https://github.com/${deployRepo}/tree/main/apps/webhook`
  // Classic-token page supports prefilling scope + description; fine-grained doesn't.
  const patUrl = 'https://github.com/settings/tokens/new?scopes=repo&description=aeon-telegram-webhook'

  // Accept a bare subdomain, a host, or a full URL — normalize to https://host.
  const trimmedWorker = workerUrl.trim().replace(/\/+$/, '')
  const fullWorkerUrl = trimmedWorker
    ? trimmedWorker.startsWith('http') ? trimmedWorker
      : `https://${trimmedWorker.includes('.') ? trimmedWorker : `aeon-telegram-webhook.${trimmedWorker}.workers.dev`}`
    : ''
  const setWebhookCmd =
    `curl "https://api.telegram.org/bot${botToken.trim() || '<YOUR_BOT_TOKEN>'}/setWebhook?url=${fullWorkerUrl || 'https://<your-worker>.workers.dev'}"`

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard blocked — the value is visible to copy manually */ }
  }

  // Telegram's API allows CORS, so the webhook can be registered straight from
  // the browser — same trick as the chat-ID helper. The token never leaves the
  // page except to api.telegram.org.
  const registerWebhook = async () => {
    if (!botToken.trim() || !fullWorkerUrl) return
    setWhBusy(true)
    setWhStatus(null)
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(fullWorkerUrl)}`)
      const data = await res.json() as { ok: boolean; description?: string }
      setWhStatus(data.ok
        ? { ok: true, msg: 'Webhook set — replies now arrive in ~1s. The poller backs off automatically.' }
        : { ok: false, msg: data.description ?? 'Telegram rejected the request — double-check the token.' })
    } catch {
      setWhStatus({ ok: false, msg: 'Could not reach api.telegram.org from the browser — copy the curl command below instead.' })
    } finally {
      setWhBusy(false)
    }
  }

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">⚡ Instant replies</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-35">optional</span>
          </div>
          <div className="text-[11px] text-primary-40 font-mono">
            {enabled
              ? 'One-time setup, about 5 minutes — three steps below.'
              : 'Aeon polls every 5 min — flip to Yes for ~1s replies via your own Cloudflare Worker.'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setEnabled(false)}
            className={`text-[11px] font-mono px-3 py-1 border transition-colors ${!enabled ? 'border-[rgba(250,250,250,0.35)] text-primary-70' : 'border-[rgba(250,250,250,0.16)] text-primary-40 hover:text-primary-70'}`}
          >
            No
          </button>
          <button
            onClick={() => setEnabled(true)}
            className={`text-[11px] font-mono px-3 py-1 border transition-colors ${enabled ? 'border-eva-green text-eva-green' : 'border-[rgba(250,250,250,0.16)] text-primary-40 hover:text-eva-green hover:border-eva-green/40'}`}
          >
            Yes
          </button>
        </div>
      </div>

      {enabled && (
        <div className="mt-3 pt-4 border-t border-[rgba(250,250,250,0.08)] space-y-5">
          <p className="text-[13px] text-primary-70 leading-relaxed">
            Replies aren&apos;t instant — by design. Aeon runs on GitHub Actions and polls Telegram every{' '}
            <span className="text-primary-100">5 minutes</span>; it&apos;s built for autonomous background work,
            not real-time chat. For <span className="text-primary-100">~1-second</span> replies, deploy a tiny
            Cloudflare Worker webhook into your own account — no shared infrastructure.
          </p>

          {/* 1 — deploy */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2">1 · Deploy the Worker</div>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" height={32} />
            </a>
            <p className="text-[11px] text-primary-35 font-mono mt-2">
              Deploys <span className="text-primary-70">{deployRepo}/webhook</span> · requires a public repo.
            </p>
          </div>

          {/* 2 — variables */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2">2 · Fill the variables in the deploy wizard</div>
            <ul className="text-[12px] font-mono text-primary-70 space-y-1.5">
              <li>
                <span className="text-primary-100">TELEGRAM_BOT_TOKEN</span>{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                  title="Open BotFather in Telegram, send /newbot (or /token for an existing bot), copy the token it replies with"
                  className="text-[10px] text-eva-orange/80 hover:text-eva-orange transition-colors">@BotFather ↗</a>
              </li>
              <li>
                <span className="text-primary-100">TELEGRAM_CHAT_ID</span>{' '}
                <span className="text-[10px] text-primary-35">— use the &quot;Find my chat ID&quot; helper above, before registering the webhook (it stops getUpdates)</span>
              </li>
              <li>
                <span className="text-primary-100">GITHUB_REPO</span> = {deployRepo}{' '}
                <button onClick={() => copy('repo', deployRepo)}
                  className="text-[10px] text-primary-40 hover:text-eva-orange transition-colors">
                  {copied === 'repo' ? 'copied' : 'copy'}
                </button>
              </li>
              <li>
                <span className="text-primary-100">GITHUB_TOKEN</span>{' '}
                <a href={patUrl} target="_blank" rel="noopener noreferrer"
                  title="Opens GitHub's token page with the repo scope and a name prefilled — generate and copy"
                  className="text-[10px] text-eva-orange/80 hover:text-eva-orange transition-colors">create token ↗</a>
              </li>
            </ul>
            <p className="text-[11px] text-primary-35 mt-2 leading-relaxed">
              The wizard prompts for these during deploy and stores them as encrypted Worker secrets in your
              Cloudflare account. Edit later: Workers &amp; Pages → your worker → Settings → Variables.
            </p>
          </div>

          {/* 3 — register */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2">3 · Point Telegram at the Worker</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)}
                placeholder="bot token..." className={inputCls} />
              <input type="text" value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && registerWebhook()}
                placeholder="aeon-telegram-webhook.<subdomain>.workers.dev" className={inputCls} />
              <button onClick={registerWebhook} disabled={!botToken.trim() || !fullWorkerUrl || whBusy}
                className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0">
                {whBusy ? 'Registering…' : 'Register'}
              </button>
            </div>
            <p className="text-[11px] text-primary-35 mt-2">
              The Worker URL is on its Overview tab in Cloudflare. The token only goes to api.telegram.org; nothing is stored.
            </p>
            {whStatus && (
              <p className={`text-[11px] font-mono mt-2 ${whStatus.ok ? 'text-eva-green' : 'text-eva-red/80'}`}>{whStatus.msg}</p>
            )}
            <div className="flex items-start gap-2 mt-3">
              <code className="flex-1 bg-aeon-bg text-primary-70 text-[11px] px-3 py-2 border border-[rgba(250,250,250,0.10)] font-mono break-all">
                {setWebhookCmd}
              </code>
              <button onClick={() => copy('cmd', setWebhookCmd)}
                className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors px-2 py-2 shrink-0">
                {copied === 'cmd' ? 'copied' : 'copy'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-primary-40 leading-relaxed">
            Once the webhook is live, the poller detects it (<span className="font-mono">getWebhookInfo</span>) and
            skips Telegram automatically — no double-processing. Full guide:{' '}
            <span className="font-mono text-primary-70">apps/webhook/README.md</span>.
          </p>
        </div>
      )}
    </div>
  )
}
