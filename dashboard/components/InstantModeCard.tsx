'use client'

import { useState } from 'react'

interface InstantModeCardProps {
  repo: string
}

const SET_WEBHOOK_CMD =
  'curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev&secret_token=<YOUR_WEBHOOK_SECRET>"'

export function InstantModeCard({ repo }: InstantModeCardProps) {
  const [copied, setCopied] = useState(false)
  const deployRepo = repo || 'aaronjmars/aeon'
  const deployUrl = `https://deploy.workers.cloudflare.com/?url=https://github.com/${deployRepo}/tree/main/webhook`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SET_WEBHOOK_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — the command is visible to copy manually */ }
  }

  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">⚡ Telegram · Instant mode</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-35">optional · ~1s</span>
      </div>

      <div className="border border-[rgba(250,250,250,0.10)] p-[var(--space-md)] space-y-5">
        <p className="text-[13px] text-primary-70 leading-relaxed">
          By default Aeon polls Telegram every 5 minutes. Deploy a tiny Cloudflare Worker as a webhook and
          replies arrive in <span className="text-primary-100">~1 second</span> — it relays each message to GitHub{' '}
          <span className="font-mono text-primary-100">repository_dispatch</span>. It runs in your own Cloudflare
          account; there&apos;s no shared infrastructure.
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

        {/* 2 — secrets */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2">2 · Set the Worker&apos;s secrets (in Cloudflare)</div>
          <ul className="text-[12px] font-mono text-primary-70 space-y-1">
            <li><span className="text-primary-100">TELEGRAM_BOT_TOKEN</span> · <span className="text-primary-100">TELEGRAM_CHAT_ID</span></li>
            <li><span className="text-primary-100">GITHUB_REPO</span> = {deployRepo} · <span className="text-primary-100">GITHUB_TOKEN</span> <span className="text-primary-35">(repo scope)</span></li>
            <li><span className="text-primary-100">TELEGRAM_WEBHOOK_SECRET</span> <span className="text-primary-35">— optional, recommended</span></li>
          </ul>
          <p className="text-[11px] text-primary-35 mt-2 leading-relaxed">
            These live in the Cloudflare dashboard (Workers &amp; Pages → your worker → Settings → Variables).
            They&apos;re separate from the GitHub secrets above — the dashboard can&apos;t set them for you.
          </p>
        </div>

        {/* 3 — register */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2">3 · Point Telegram at the Worker</div>
          <div className="flex items-start gap-2">
            <code className="flex-1 bg-aeon-bg text-primary-70 text-[11px] px-3 py-2 border border-[rgba(250,250,250,0.10)] font-mono break-all">
              {SET_WEBHOOK_CMD}
            </code>
            <button onClick={copy}
              className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors px-2 py-2 shrink-0">
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-primary-40 leading-relaxed">
          Once the webhook is live, the poller detects it (<span className="font-mono">getWebhookInfo</span>) and
          skips Telegram automatically — no double-processing. Full guide:{' '}
          <span className="font-mono text-primary-70">webhook/README.md</span>.
        </p>
      </div>
    </section>
  )
}
