'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { ArrowUpRightLightIcon } from './glass/d/icons'
import { ACTION, ActionButton, Field, PrimaryButton, TAG } from './glass/connect/ui'
import { CommandBox } from './ui/CommandBox'
import { KeyName } from './ui/KeyName'
import {
  BODY,
  QUIET_TAG,
  ExternalLink,
  HINT,
  INLINE_CODE,
  SegmentedChoice,
  StatusNote,
  StepLabel,
} from './glass/connect/forms'
import type { TelegramStatus } from '../lib/types'

interface InstantModeCardProps {
  repo: string
  // Bot token saved earlier in this session - secrets are write-only on GitHub,
  // so this is the only chance to pre-fill it for the setWebhook step.
  sessionBotToken?: string
}

// 32 random bytes as hex: inside Telegram's secret_token alphabet
// ([A-Za-z0-9_-], 1-256 chars).
function newWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// Rendered as a row inside the Telegram credentials list: a one-liner with a
// Yes/No choice when collapsed, the full Cloudflare Worker walkthrough when on.
export function InstantModeCard({ repo, sessionBotToken }: InstantModeCardProps) {
  const [enabled, setEnabled] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [workerUrl, setWorkerUrl] = useState('')
  const [whBusy, setWhBusy] = useState(false)
  const [whStatus, setWhStatus] = useState<TelegramStatus | null>(null)
  // Shared secret the Worker checks on every update (TELEGRAM_WEBHOOK_SECRET);
  // Telegram echoes it back only when setWebhook was called with secret_token.
  // Without it the Worker 403s every update and inbound Telegram goes dead.
  const [webhookSecret, setWebhookSecret] = useState('')

  useEffect(() => {
    if (sessionBotToken) setBotToken(sessionBotToken)
  }, [sessionBotToken])

  const deployRepo = repo || 'aeonfun/aeon'
  const deployUrl = `https://deploy.workers.cloudflare.com/?url=https://github.com/${deployRepo}/tree/main/apps/webhook`
  // Classic-token page supports prefilling scope + description; fine-grained doesn't.
  const patUrl = 'https://github.com/settings/tokens/new?scopes=repo&description=aeon-telegram-webhook'

  // Accept a bare subdomain, a host, or a full URL - normalize to https://host.
  const trimmedWorker = workerUrl.trim().replace(/\/+$/, '')
  const fullWorkerUrl = trimmedWorker
    ? trimmedWorker.startsWith('http')
      ? trimmedWorker
      : `https://${trimmedWorker.includes('.') ? trimmedWorker : `aeon-telegram-webhook.${trimmedWorker}.workers.dev`}`
    : ''
  const secret = webhookSecret.trim()
  const setWebhookCmd = `curl "https://api.telegram.org/bot${botToken.trim() || '<YOUR_BOT_TOKEN>'}/setWebhook?url=${fullWorkerUrl || 'https://<your-worker>.workers.dev'}&secret_token=${secret || '<YOUR_WEBHOOK_SECRET>'}"`

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard blocked - the value is visible to copy manually */
    }
  }

  // Telegram's API allows CORS, so the webhook can be registered straight from
  // the browser - same trick as the chat-ID helper. The token never leaves the
  // page except to api.telegram.org.
  const registerWebhook = async () => {
    if (!botToken.trim() || !fullWorkerUrl || !secret) return
    setWhBusy(true)
    setWhStatus(null)
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(fullWorkerUrl)}&secret_token=${encodeURIComponent(secret)}`,
      )
      const data = (await res.json()) as { ok: boolean; description?: string }
      setWhStatus(
        data.ok
          ? { ok: true, msg: 'Webhook set: replies now arrive in about a second. The poller backs off on its own.' }
          : { ok: false, msg: data.description ?? 'Telegram rejected the request. Check the token.' },
      )
    } catch {
      setWhStatus({
        ok: false,
        msg: 'Could not reach api.telegram.org from the browser. Run the command below instead.',
      })
    } finally {
      setWhBusy(false)
    }
  }

  const varRow = 'flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0'
  const varName = 'font-mono text-[13px] font-medium [overflow-wrap:anywhere]'

  return (
    <div className="px-3 py-4 sm:pl-[calc(22px+1.75rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">Instant replies</span>
            <span className={cn(TAG, QUIET_TAG)}>Optional</span>
          </p>
          <p className={cn(HINT, 'mt-1 max-w-[78ch]')}>
            {enabled
              ? 'One-time setup, about 5 minutes: three steps below.'
              : 'Aeon checks Telegram every 5 minutes. Turn this on for replies in about a second, through your own Cloudflare Worker.'}
          </p>
        </div>
        <SegmentedChoice
          label="Instant replies"
          value={enabled ? 'yes' : 'no'}
          options={
            [
              { id: 'no', label: 'No' },
              { id: 'yes', label: 'Yes' },
            ] as const
          }
          // The secret is generated client-side on opt-in (the walkthrough only
          // renders after this click), so server render and hydration agree.
          onChange={v => {
            if (v === 'yes') {
              setEnabled(true)
              setWebhookSecret(cur => cur || newWebhookSecret())
            } else setEnabled(false)
          }}
          className="shrink-0 flex-nowrap"
        />
      </div>

      {enabled && (
        <div className="mt-4 space-y-7 border-t border-[var(--line)] pt-5">
          <p className={cn(BODY, 'max-w-[78ch]')}>
            Replies are not instant by design. Aeon runs on GitHub Actions and checks Telegram every{' '}
            <strong className="font-medium text-foreground">5 minutes</strong>; it is built for background work, not
            live chat. For replies in about <strong className="font-medium text-foreground">1 second</strong>, deploy a
            tiny Cloudflare Worker webhook into your own account, with no shared infrastructure.
          </p>

          {/* 1 - deploy */}
          <div>
            <StepLabel n={1}>Deploy the Worker</StepLabel>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" className={cn(ACTION, 'h-11 pr-4 pl-5')}>
              Deploy to Cloudflare
              <ArrowUpRightLightIcon className="size-4 text-muted-foreground" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className={cn(HINT, 'mt-2')}>
              Deploys <code className={INLINE_CODE}>{deployRepo}/webhook</code>. Needs a public repo.
            </p>
          </div>

          {/* 2 - variables */}
          <div>
            <StepLabel n={2}>Fill the variables in the deploy wizard</StepLabel>
            <ul className="rounded-[18px] bg-[rgb(255_255_255/0.5)] px-4 py-4 shadow-[inset_0_0_0_1px_var(--line)] [&>li+li]:border-t [&>li+li]:border-[var(--line)]">
              <li className={varRow}>
                <span className={varName}>
                  <KeyName name="TELEGRAM_BOT_TOKEN" />
                </span>
                <span className={HINT}>
                  <ExternalLink
                    href="https://t.me/BotFather"
                    title="Open BotFather in Telegram, send /newbot (or /token for an existing bot), copy the token it replies with"
                  >
                    From @BotFather
                  </ExternalLink>
                </span>
              </li>
              <li className={varRow}>
                <span className={varName}>
                  <KeyName name="TELEGRAM_CHAT_ID" />
                </span>
                <span className={HINT}>
                  Use Find my chat ID above, before registering the webhook (the webhook stops getUpdates).
                </span>
              </li>
              <li className={varRow}>
                <span className={varName}>
                  <KeyName name="TELEGRAM_WEBHOOK_SECRET" />
                </span>
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Field
                      label="Telegram webhook secret"
                      hideLabel
                      className="min-w-0 flex-1"
                      inputClassName="font-mono sm:text-[14px]"
                      value={webhookSecret}
                      spellCheck={false}
                      onChange={e => setWebhookSecret(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256))}
                    />
                    <span className="flex gap-2">
                      <ActionButton onClick={() => copy('secret', webhookSecret)} className="h-12">
                        {copied === 'secret' ? 'Copied' : 'Copy'}
                      </ActionButton>
                      <ActionButton
                        onClick={() => setWebhookSecret(newWebhookSecret())}
                        className="h-12"
                        title="Make a new random secret"
                      >
                        New
                      </ActionButton>
                    </span>
                  </span>
                  <span className={cn(HINT, 'block')}>
                    Random, made here; step 3 sends the same value to Telegram (paste yours if the Worker already has
                    one).
                  </span>
                </span>
              </li>
              <li className={varRow}>
                <span className={varName}>
                  <KeyName name="GITHUB_REPO" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className={INLINE_CODE}>{deployRepo}</code>
                  <ActionButton onClick={() => copy('repo', deployRepo)} className="h-9 px-3.5 text-[13px]">
                    {copied === 'repo' ? 'Copied' : 'Copy'}
                  </ActionButton>
                </span>
              </li>
              <li className={varRow}>
                <span className={varName}>
                  <KeyName name="GITHUB_TOKEN" />
                </span>
                <span className={HINT}>
                  <ExternalLink
                    href={patUrl}
                    title="Opens GitHub's token page with the repo scope and a name prefilled - generate and copy"
                  >
                    Create a token
                  </ExternalLink>
                </span>
              </li>
            </ul>
            <p className={cn(HINT, 'mt-3 max-w-[78ch]')}>
              The wizard asks for these during deploy and stores them as encrypted Worker secrets in your Cloudflare
              account. To edit later: Workers &amp; Pages, your worker, Settings, Variables.
            </p>
          </div>

          {/* 3 - register */}
          <div>
            <StepLabel n={3}>Point Telegram at the Worker</StepLabel>
            <div className="flex flex-col gap-2 lg:flex-row">
              <Field
                label="Bot token"
                hideLabel
                className="min-w-0 flex-1"
                type="password"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                placeholder="Bot token"
                autoComplete="off"
              />
              <Field
                label="Worker URL"
                hideLabel
                className="min-w-0 flex-[1.4]"
                value={workerUrl}
                onChange={e => setWorkerUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && registerWebhook()}
                placeholder="aeon-telegram-webhook.<subdomain>.workers.dev"
                spellCheck={false}
              />
              <PrimaryButton
                onClick={registerWebhook}
                disabled={!botToken.trim() || !fullWorkerUrl || !secret || whBusy}
                className="h-12 shrink-0"
              >
                {whBusy ? 'Registering' : 'Register'}
              </PrimaryButton>
            </div>
            <p className={cn(HINT, 'mt-2')}>
              The Worker URL is on its Overview tab in Cloudflare. The token only goes to api.telegram.org; nothing is
              stored.
            </p>
            {whStatus && (
              <StatusNote tone={whStatus.ok ? 'ok' : 'error'} className="mt-2">
                {whStatus.msg}
              </StatusNote>
            )}
            <div className="mt-3">
              <CommandBox command={setWebhookCmd} label="Or run it yourself" />
            </div>
          </div>

          <p className={cn(HINT, 'max-w-[78ch]')}>
            Once the webhook is live, the poller sees it (<code className={INLINE_CODE}>getWebhookInfo</code>) and skips
            Telegram on its own, so nothing is handled twice. Full guide:{' '}
            <code className={INLINE_CODE}>apps/webhook/README.md</code>.
          </p>
        </div>
      )}
    </div>
  )
}
