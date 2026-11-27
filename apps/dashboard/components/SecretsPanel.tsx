'use client'

import { useState, useEffect, useRef, useId } from 'react'
import type { Secret, Skill } from '../lib/types'
import { displayName } from '../lib/utils'
import { keyProvidedByHarness } from '../lib/constants'
import { KeyName } from './ui/KeyName'
import { ServiceIcon } from './ui/ServiceIcon'
import type { ServiceGlyph } from '../lib/service-icons'
import { linkify } from './ui/Linkify'
import { InstantModeCard } from './InstantModeCard'
import { LangfuseRegionCard } from './LangfuseRegionCard'
import { TelegramCommandsCard } from './TelegramCommandsCard'
import { TelegramChatIdHelper } from './TelegramChatIdHelper'
import { TelegramLinkCard } from './TelegramLinkCard'
import { OAUTH_SECRET_HARNESS } from '../lib/harness-auth'
import { CountUp } from './glass/count-up'
import { ActionButton, Chevron, Field, LABEL, PageHeader, PrimaryButton, SMALL_LABEL, TAG } from './glass/connect/ui'
import { BODY, ExternalLink, HINT, INLINE_CODE, QUIET_TAG, StatusNote } from './glass/connect/forms'
import { cn } from '@/lib/cn'

// Logo shown next to each credential group's header. Brand groups use their
// favicon; non-brand groups use a glyph.
const GROUP_ICON: Record<string, { domain?: string; glyph?: ServiceGlyph }> = {
  Core: { glyph: 'key' },
  Telegram: { domain: 'telegram.org' },
  Discord: { domain: 'discord.com' },
  Slack: { domain: 'slack.com' },
  Email: { glyph: 'mail' },
  Observability: { domain: 'langfuse.com' },
  MCP: { glyph: 'server' },
  'Skill Keys': { glyph: 'key' },
}

// Render order. MCP sits next to Skill Keys because both answer "what can a
// skill reach out to". It's populated dynamically from whatever MCP_*_TOKEN /
// _OAUTH secrets exist (see describeMcpSecret in lib/secrets-catalog.ts), so
// the section simply doesn't render until a server is connected.
const GROUP_ORDER = ['Core', 'Telegram', 'Discord', 'Slack', 'Email', 'Observability', 'MCP', 'Skill Keys']

// Plain group titles (the catalog's group ids stay as they are).
const GROUP_TITLE: Record<string, string> = { Core: 'Model and GitHub', 'Skill Keys': 'Skill keys', MCP: 'MCP servers' }

interface SecretsPanelProps {
  secrets: Secret[]
  skills: Skill[]
  busy: Record<string, boolean>
  repo: string
  harness: string
  focusKey?: string | null
  onFocusHandled?: () => void
  onSave: (name: string, value: string) => void
  onDelete: (name: string) => void
  onSelectSkill: (name: string) => void
  // Open the Connect modal for a harness (its login or key).
  onConnect: (harness: string) => void
  // A secret was saved by a flow outside onSave (the Telegram chat link).
  onMarkSet: (name: string) => void
  onConnectGithub: () => void
  githubConnecting?: boolean
}

// Keys: every credential the agent holds, grouped by channel. Each key is a row that opens in
// place (like the security list): the row shows the name, what it is for and whether it is set;
// open, it shows where to get it, which skills use it, and the field to set it or the button to
// remove it.
export function SecretsPanel({
  secrets,
  skills,
  busy,
  repo,
  harness,
  focusKey,
  onFocusHandled,
  onSave,
  onDelete,
  onSelectSkill,
  onConnect,
  onMarkSet,
  onConnectGithub,
  githubConnecting,
}: SecretsPanelProps) {
  // The one open row; an unset key shows its value field when open.
  const [editingSecret, setEditingSecret] = useState<string | null>(null)
  const [secretValue, setSecretValue] = useState('')
  const [addingSecret, setAddingSecret] = useState(false)
  const [newSecretName, setNewSecretName] = useState('')
  // Bot token saved this session, kept to pre-fill the chat-ID helper -
  // GitHub secrets are write-only, so it can't be read back later.
  const [sessionBotToken, setSessionBotToken] = useState('')

  // Deep-link from a skill's API-keys panel: open the requested key's editor,
  // scroll it into view, and clear the request so re-navigating works.
  useEffect(() => {
    if (!focusKey) return
    setEditingSecret(focusKey)
    setSecretValue('')
    const t = setTimeout(() => {
      document.getElementById(`secret-${focusKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document
        .querySelector<HTMLInputElement>(`#secret-${focusKey} input[type="password"]`)
        ?.focus({ preventScroll: true })
    }, 60)
    onFocusHandled?.()
    return () => clearTimeout(t)
  }, [focusKey, onFocusHandled])

  // Reverse index: which skills declare each credential, and whether they
  // require it or just work better with it. Powers the "used by" line so the
  // operator can see what a key unlocks before setting it.
  const usedBy = new Map<string, { name: string; optional: boolean }[]>()
  for (const sk of skills) {
    for (const r of sk.requires ?? []) {
      const list = usedBy.get(r.key) ?? []
      list.push({ name: sk.name, optional: r.optional })
      usedBy.set(r.key, list)
    }
  }

  // Claude Code auth is an either/or pair (OAuth token or API key). Once either
  // is set, auth is satisfied - so the OAuth "Connect" button is redundant.
  const claudeAuthSet = secrets.some(s => s.either === 'auth' && s.isSet)

  const handleSave = (name: string) => {
    if (!secretValue.trim()) return
    if (name === 'TELEGRAM_BOT_TOKEN') setSessionBotToken(secretValue.trim())
    onSave(name, secretValue.trim())
    setEditingSecret(null)
    setSecretValue('')
    setAddingSecret(false)
    setNewSecretName('')
  }

  const toggle = (name: string) => {
    setSecretValue('')
    setEditingSecret(cur => (cur === name ? null : name))
  }

  const setCount = secrets.filter(s => s.isSet).length

  return (
    <div className="space-y-[clamp(36px,4vw,56px)] pb-4">
      <PageHeader
        title="Keys"
        sub={
          <>Set a secret, the channel turns on. Values are saved as encrypted GitHub secrets and never shown again.</>
        }
      />

      {GROUP_ORDER.map(group => {
        const gs = secrets.filter(s => s.group === group)
        if (!gs.length) return null
        const headId = `keys-${group.replace(/\W+/g, '-').toLowerCase()}`
        const set = gs.filter(s => s.isSet).length
        return (
          <section key={group} aria-labelledby={headId}>
            <div className="flex min-h-10 items-center gap-3">
              <ServiceIcon domain={GROUP_ICON[group]?.domain} glyph={GROUP_ICON[group]?.glyph} />
              <h2 id={headId} className={LABEL}>
                {GROUP_TITLE[group] ?? group}
              </h2>
              <span className="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums">
                {/* MCP rows only exist once a server is connected, so "n of n set"
                    would always read 100%. Count them instead. */}
                {group === 'MCP' ? (
                  <>
                    <CountUp to={gs.length} duration={1.2} /> credential{gs.length === 1 ? '' : 's'}
                  </>
                ) : (
                  <>
                    <CountUp to={set} duration={1.2} /> of {gs.length} set
                  </>
                )}
              </span>
            </div>
            {group === 'MCP' && (
              <p className={cn(HINT, 'mt-2 max-w-[78ch]')}>
                Credentials belonging to the servers on the MCP page. They are created there (paste a bearer token, or
                Connect for OAuth) and listed here so every key the agent holds shows up in one place. Removing one here
                leaves its server wired in <code className={INLINE_CODE}>.mcp.json</code> but unauthenticated, and runs
                skip MCP with a warning until it is set again.
              </p>
            )}
            <ul className="g-chip mt-3 flex flex-col gap-0.5 rounded-[22px] p-1.5">
              {gs.map(secret => (
                <SecretRow
                  key={secret.name}
                  secret={secret}
                  open={editingSecret === secret.name}
                  onToggle={() => toggle(secret.name)}
                  value={editingSecret === secret.name ? secretValue : ''}
                  onValue={setSecretValue}
                  onSave={() => handleSave(secret.name)}
                  onCancel={() => {
                    setEditingSecret(null)
                    setSecretValue('')
                  }}
                  onDelete={() => onDelete(secret.name)}
                  removing={!!busy[`sec-${secret.name}`]}
                  harnessCovers={keyProvidedByHarness(secret.name, harness) && !secret.isSet}
                  usedBy={usedBy.get(secret.name) ?? []}
                  onSelectSkill={onSelectSkill}
                  connect={
                    secret.name === 'CLAUDE_CODE_OAUTH_TOKEN' && !claudeAuthSet
                      ? {
                          label: 'Connect',
                          title:
                            'Connect Claude: run claude setup-token and paste the token, or use an API key or OpenRouter.',
                          run: () => onConnect('claude'),
                        }
                      : secret.name === 'GROK_CREDENTIALS'
                        ? {
                            label: secret.isSet ? 'Reconnect' : 'Connect',
                            title:
                              'Connect Grok: log in with your X account and paste the captured login, or use an xAI key. Use Reconnect if the session expires.',
                            run: () => onConnect('grok'),
                          }
                        : secret.name === 'GH_GLOBAL'
                          ? {
                              label: githubConnecting ? 'Connecting' : secret.isSet ? 'Reconnect' : 'Connect',
                              title:
                                "Copy this machine's GitHub CLI token into GH_GLOBAL so Actions can push, open PRs, and call other repos. Uses the gh session the dashboard already has, no extra login. Use Reconnect after gh auth switch. Or paste a PAT below.",
                              run: onConnectGithub,
                              busy: githubConnecting,
                            }
                          : OAUTH_SECRET_HARNESS[secret.name]
                            ? {
                                label: secret.isSet ? 'Reconnect' : 'Connect',
                                title: `Connect ${OAUTH_SECRET_HARNESS[secret.name]}: log in and paste the captured login. Use Reconnect if it expires.`,
                                run: () => onConnect(OAUTH_SECRET_HARNESS[secret.name]),
                              }
                            : null
                  }
                  canPaste={!OAUTH_SECRET_HARNESS[secret.name]}
                  extra={
                    secret.name === 'TELEGRAM_CHAT_ID' ? (
                      <TelegramChatIdHelper
                        defaultToken={sessionBotToken}
                        onFound={chatId => {
                          setEditingSecret('TELEGRAM_CHAT_ID')
                          setSecretValue(chatId)
                        }}
                      />
                    ) : secret.name === 'TELEGRAM_BOT_TOKEN' ? (
                      <p className={HINT}>
                        <ExternalLink
                          href="https://t.me/BotFather"
                          title="Opens BotFather in Telegram. Send /newbot and follow the prompts (or /token for an existing bot) - it replies with the bot token, e.g. 123456789:AAxx... Paste that here."
                        >
                          Get one from @BotFather
                        </ExternalLink>{' '}
                        Send /newbot (or /token for an existing bot) and paste the token it replies with.
                      </p>
                    ) : null
                  }
                />
              ))}
              {group === 'Telegram' &&
                (sessionBotToken || secrets.some(s => s.name === 'TELEGRAM_BOT_TOKEN' && s.isSet)) && (
                  <li className="border-t border-[var(--line)]">
                    <TelegramLinkCard
                      sessionBotToken={sessionBotToken}
                      chatIdSet={secrets.some(s => s.name === 'TELEGRAM_CHAT_ID' && s.isSet)}
                      onLinked={() => onMarkSet('TELEGRAM_CHAT_ID')}
                    />
                  </li>
                )}
              {group === 'Telegram' && (
                <li className="border-t border-[var(--line)]">
                  <TelegramCommandsCard tokenSet={secrets.some(s => s.name === 'TELEGRAM_BOT_TOKEN' && s.isSet)} />
                </li>
              )}
              {group === 'Telegram' && (
                <li className="border-t border-[var(--line)]">
                  <InstantModeCard repo={repo} sessionBotToken={sessionBotToken} />
                </li>
              )}
              {group === 'Observability' && (
                <li className="border-t border-[var(--line)]">
                  <LangfuseRegionCard
                    keysSet={
                      secrets.some(s => s.name === 'LANGFUSE_PUBLIC_KEY' && s.isSet) &&
                      secrets.some(s => s.name === 'LANGFUSE_SECRET_KEY' && s.isSet)
                    }
                  />
                </li>
              )}
            </ul>
          </section>
        )
      })}

      {/* Any other secret, by name */}
      <section aria-labelledby="keys-add">
        <h2 id="keys-add" className="sr-only">
          Add a key
        </h2>
        {addingSecret ? (
          <div className="g-chip space-y-4 rounded-[22px] px-4 py-5 sm:px-6">
            <p className={LABEL}>Add a key</p>
            <Field
              label="Secret name"
              value={newSecretName}
              onChange={e => setNewSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="SECRET_NAME"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              inputClassName="font-mono"
            />
            {newSecretName && (
              <Field
                label="Value"
                type="password"
                value={secretValue}
                onChange={e => setSecretValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave(newSecretName)}
                placeholder="Paste the value"
                autoComplete="off"
              />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton
                onClick={() => {
                  setAddingSecret(false)
                  setNewSecretName('')
                  setSecretValue('')
                }}
              >
                Cancel
              </ActionButton>
              {newSecretName && (
                <PrimaryButton onClick={() => handleSave(newSecretName)} disabled={!secretValue.trim()}>
                  Save
                </PrimaryButton>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSecret(true)}
            className="group g-chip flex w-full cursor-pointer items-center gap-4 rounded-[22px] px-5 py-4 text-left transition-[background-color] duration-150 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
          >
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[oklch(0.3_0.015_240/0.06)] text-muted-foreground transition-colors duration-150 group-hover:text-[var(--primary)]"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[1.1875rem] leading-[1.3] font-light tracking-[-0.012em]">
                Add a key
              </span>
              <span className="mt-0.5 block text-[14px] text-muted-foreground">
                Any other secret a skill reads, by name
              </span>
            </span>
          </button>
        )}
      </section>
    </div>
  )
}

function SecretRow({
  secret,
  open,
  onToggle,
  value,
  onValue,
  onSave,
  onCancel,
  onDelete,
  removing,
  harnessCovers,
  usedBy,
  onSelectSkill,
  connect,
  canPaste,
  extra,
}: {
  secret: Secret
  open: boolean
  onToggle: () => void
  value: string
  onValue: (v: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  removing: boolean
  harnessCovers: boolean
  usedBy: { name: string; optional: boolean }[]
  onSelectSkill: (name: string) => void
  connect: { label: string; title: string; run: () => void; busy?: boolean } | null
  // OAuth logins are captured by the Connect flow, never pasted here.
  canPaste: boolean
  extra: React.ReactNode
}) {
  const id = useId()
  const field = useRef<HTMLDivElement>(null)
  // Opening an unset key by click or keyboard puts the cursor in its value field.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current && !secret.isSet && canPaste)
      field.current?.querySelector('input')?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open, secret.isSet, canPaste])

  const sorted = [...usedBy].sort((a, b) => Number(a.optional) - Number(b.optional))
  return (
    <li
      id={`secret-${secret.name}`}
      className={cn(
        'group scroll-mt-28 rounded-[16px] transition-[background-color] duration-200',
        open && 'bg-[var(--hover)]',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="group/row grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_1rem] items-center gap-x-3 rounded-[14px] px-3 py-3 text-left transition-[background-color] duration-150 outline-none hover:bg-[var(--hover)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--foreground)] sm:gap-x-4"
      >
        <ServiceIcon name={secret.name} />
        <span className="min-w-0">
          <span className="block font-mono text-[13px] font-medium [overflow-wrap:anywhere]">
            <KeyName name={secret.name} />
          </span>
          {/* Open, the full text (with its links) moves into the detail below. */}
          {!open && (
            <span className="mt-0.5 block truncate text-[14px] leading-[1.45] text-muted-foreground">
              {secret.description}
            </span>
          )}
        </span>
        <span
          className={cn(
            TAG,
            'shrink-0',
            secret.isSet
              ? 'bg-[var(--primary)] text-[var(--foreground)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]'
              : QUIET_TAG,
          )}
        >
          {secret.isSet ? 'Set' : 'Not set'}
        </span>
        <Chevron open={open} className="transition-[rotate,color] group-hover/row:text-foreground" />
      </button>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-4 px-3 pt-1 pb-5 sm:pl-[calc(22px+1.75rem)]">
            <p className={BODY}>{linkify(secret.description)}</p>
            {harnessCovers && (
              <StatusNote tone="info" live={false}>
                Covered by the Grok Build harness (built-in web search) - optional here; set it for the premium xAI
                x_search feed, used by both harnesses.
              </StatusNote>
            )}
            {extra}
            {sorted.length > 0 && (
              <div>
                <p className={SMALL_LABEL}>Used by</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {sorted.map(u => (
                    <li key={u.name}>
                      <button
                        type="button"
                        onClick={() => onSelectSkill(u.name)}
                        title={u.optional ? 'Works better with this key' : 'Required for this skill'}
                        className="g-chip flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[14px] transition-[background-color] duration-150 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
                      >
                        {displayName(u.name)}
                        <span className="font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
                          {u.optional ? 'optional' : 'needs it'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!secret.isSet && canPaste && (
              <div ref={field} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field
                  label={`Value for ${secret.name}`}
                  hideLabel
                  className="min-w-0 flex-1"
                  type="password"
                  value={value}
                  onChange={e => onValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSave()}
                  placeholder="Paste the value"
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <ActionButton onClick={onCancel} className="h-12">
                    Cancel
                  </ActionButton>
                  <PrimaryButton onClick={onSave} disabled={!value.trim()} className="h-12 flex-1 sm:flex-none">
                    Save
                  </PrimaryButton>
                </div>
              </div>
            )}
            {(connect || secret.isSet) && (
              <div className="flex flex-wrap gap-2">
                {connect && (
                  <ActionButton onClick={connect.run} disabled={connect.busy} title={connect.title}>
                    {connect.label}
                  </ActionButton>
                )}
                {secret.isSet && (
                  <ActionButton
                    onClick={onDelete}
                    disabled={removing}
                    title={`Delete ${secret.name} from the repo's GitHub secrets`}
                    className="ml-auto"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className="size-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
                    </svg>
                    {removing ? 'Removing' : 'Remove'}
                  </ActionButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
