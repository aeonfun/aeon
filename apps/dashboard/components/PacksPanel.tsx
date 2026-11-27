'use client'

import { useState } from 'react'
import type { Pack, CommunityPack, Skill } from '../lib/types'
import { displayName } from '../lib/utils'
import { FIRST_PARTY_KEYS, DEFAULT_VISIBLE_PACKS } from '../lib/constants'
import { Section } from './ui/Section'
import { SkillGlyph, hasSkillGlyph } from './ui/SkillGlyph'
import { CountUp } from './glass/count-up'
import { ArrowUpRightLightIcon, CheckLightIcon, CopyLightIcon } from './glass/d/icons'
import {
  ACTION,
  ActionButton,
  CARD,
  CARD_TITLE,
  Chevron,
  Chip,
  EmptyState,
  FOCUS,
  IconButton,
  NewTab,
  PageHeader,
  SKELETON,
  Stats,
  TAG,
  TAG_INK,
  TAG_MUTED,
} from './glass/connect/ui'
import { cn } from '@/lib/cn'

interface PacksPanelProps {
  firstParty: Pack[]
  community: CommunityPack[]
  skills: Skill[]
  enabledPacks: string[]
  loading: boolean
  busy: Record<string, boolean>
  onTogglePack: (key: string) => void
  onToggleSkill: (slug: string, enabled: boolean) => void
  onSelectSkill: (slug: string) => void
  onInstallPack: (arg: string) => Promise<void> | void
}

// A pack's skills can live in a subdirectory of its repo (declared via `path` in
// skill-packs.json). Forward it as a `--path` flag so both the one-click install
// and the copyable command point the installer at the right manifest. See #492.
function installArg(pack: CommunityPack): string {
  return pack.path ? `${pack.repo} --path ${pack.path}` : pack.repo
}

// Trust level as a tag: trusted = ink, community or unknown = muted (no green or amber).
function trustTone(level?: string): string {
  return level === 'trusted' ? TAG_INK : TAG_MUTED
}

export function PacksPanel({
  firstParty,
  community,
  skills,
  enabledPacks,
  loading,
  busy,
  onTogglePack,
  onToggleSkill,
  onSelectSkill,
  onInstallPack,
}: PacksPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)

  const handleCopy = async (pack: CommunityPack) => {
    try {
      await navigator.clipboard.writeText(`bin/install-skill-pack ${installArg(pack)}`)
      setCopied(pack.repo)
      setTimeout(() => setCopied(c => (c === pack.repo ? null : c)), 1500)
    } catch {
      /* clipboard blocked - the command is still shown in the tooltip */
    }
  }

  const handleInstall = async (pack: CommunityPack) => {
    setInstalling(pack.repo)
    try {
      await onInstallPack(installArg(pack))
    } finally {
      setInstalling(null)
    }
  }

  // Live enabled state comes from the skills roster (single source of truth), so
  // toggling a skill updates the counts here instantly. Hide declared-but-empty
  // packs (e.g. the Lab catch-all when nothing is unsorted).
  const enabledBySlug = new Map(skills.map(s => [s.name, s.enabled]))
  // Default-visible packs (Core + Basics) and community packs (anything not
  // first-party - installed from another repo) are always shown, not togglable:
  // Core/Basics are the load-bearing default set, and community skills are ones
  // you added on purpose.
  const isPackOn = (key: string) =>
    DEFAULT_VISIBLE_PACKS.has(key) || !FIRST_PARTY_KEYS.has(key) || enabledPacks.includes(key)
  const visiblePacks = firstParty
    .filter(p => p.total > 0)
    .map(p => {
      const members = p.skills.map(s => ({ ...s, enabled: enabledBySlug.get(s.slug) ?? false }))
      return { ...p, skills: members, enabled: members.filter(m => m.enabled).length }
    })
  const totalSkills = visiblePacks.reduce((n, p) => n + p.total, 0)
  const onDuty = visiblePacks.reduce((n, p) => n + p.enabled, 0)
  const packsOn = visiblePacks.filter(p => isPackOn(p.key)).length

  const stats = [
    { label: 'Packs', value: visiblePacks.length },
    { label: 'Packs enabled', value: packsOn },
    { label: 'Skills', value: totalSkills },
    { label: 'Skills enabled', value: onDuty },
  ]

  const header = <PageHeader title="Packs" sub="Curated bundles of skills." />

  if (loading) {
    // Skeleton mirrors the loaded layout (header + stat grid + card grid) so the
    // page doesn't reflow when data lands. Static labels stay real; only the
    // data-driven surfaces pulse.
    return (
      <div className="space-y-[clamp(36px,4vw,56px)]" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading packs...</span>
        {header}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(CARD, 'flex flex-col gap-3 px-5 py-5')}>
              <div className={cn(SKELETON, 'h-10 w-14 rounded-[12px]')} />
              <div className={cn(SKELETON, 'h-3 w-16')} />
            </div>
          ))}
        </div>
        <Section label="Your packs">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(CARD, 'flex flex-col gap-3 px-5 py-5')}>
                <div className={cn(SKELETON, 'h-4 w-32')} />
                <div className={cn(SKELETON, 'h-3 w-20')} />
                <div className="space-y-2 pt-1">
                  <div className={cn(SKELETON, 'h-3 w-full')} />
                  <div className={cn(SKELETON, 'h-3 w-5/6')} />
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <div className={cn(SKELETON, 'h-10 w-28')} />
                  <div className={cn(SKELETON, 'h-10 w-24')} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    )
  }

  return (
    <div className="space-y-[clamp(36px,4vw,56px)]">
      {header}
      <Stats items={stats} label="Pack numbers" />

      {/* First-party packs */}
      <Section label="Your packs">
        <ul className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
          {visiblePacks.map(pack => {
            const isDefaultVisible = DEFAULT_VISIBLE_PACKS.has(pack.key)
            const isCommunity = !FIRST_PARTY_KEYS.has(pack.key)
            const isLocked = isDefaultVisible || isCommunity
            const on = isPackOn(pack.key)
            const open = expanded === pack.key
            const listId = `pack-skills-${pack.key}`
            return (
              <li key={pack.key} className={cn(CARD, 'flex flex-col')}>
                <div className="flex flex-1 flex-col gap-3 px-5 py-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={CARD_TITLE}>{pack.name}</h3>
                      {isCommunity && <span className={cn(TAG, TAG_MUTED)}>Installed</span>}
                    </div>
                    <p className="mt-1 font-mono text-[12px] tracking-[0.04em] text-muted-foreground tabular-nums">
                      <CountUp to={pack.total} duration={1.2} /> skill{pack.total === 1 ? '' : 's'}
                      {pack.enabled > 0 && (
                        <>
                          {' '}
                          · <CountUp to={pack.enabled} duration={1.2} /> on
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-[15px] leading-[1.5] text-[var(--g-ink-soft)]">{pack.description}</p>

                  {/* Two even columns, so every card's buttons sit on one row at the same size. */}
                  <div className="mt-auto grid grid-cols-2 items-center gap-2 pt-2">
                    <Chip
                      on={on}
                      onClick={() => onTogglePack(pack.key)}
                      disabled={isLocked}
                      title={
                        isCommunity
                          ? 'Skills you installed are always shown'
                          : isDefaultVisible
                            ? 'Shown by default - always enabled'
                            : on
                              ? 'Hide this pack’s skills from the dashboard'
                              : 'Reveal this pack’s skills across the sidebar and HQ'
                      }
                      className="min-w-0 justify-center px-3 whitespace-nowrap disabled:cursor-default"
                    >
                      {on && <CheckLightIcon className="size-3.5 shrink-0" />}
                      <span className="truncate">{isLocked ? 'Always on' : on ? 'Enabled' : 'Enable'}</span>
                    </Chip>
                    <ActionButton
                      onClick={() => setExpanded(open ? null : pack.key)}
                      aria-expanded={open}
                      aria-controls={listId}
                      className="min-w-0 px-3"
                    >
                      {open ? 'Hide skills' : 'View skills'}
                      <Chevron open={open} />
                    </ActionButton>
                  </div>
                </div>

                <div
                  id={listId}
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="min-h-0 overflow-hidden" inert={!open}>
                    <ul className="flex flex-col gap-0.5 border-t border-[var(--line)] p-1.5">
                      {pack.skills.map(s => {
                        const sb = busy[s.slug]
                        return (
                          <li key={s.slug} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onToggleSkill(s.slug, !s.enabled)}
                              disabled={sb}
                              aria-pressed={s.enabled}
                              aria-label={`${displayName(s.slug)}: ${s.enabled ? 'on, turn off' : 'off, turn on'}`}
                              title={s.enabled ? 'Disable skill' : 'Enable skill'}
                              className={cn(
                                'h-8 min-w-12 shrink-0 cursor-pointer px-3 rounded-full font-mono text-[11px] font-medium tracking-[0.08em] uppercase transition-[background-color,color] duration-150 disabled:cursor-wait disabled:opacity-50',
                                s.enabled
                                  ? 'bg-[var(--foreground)] text-[var(--g-paper)]'
                                  : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)] hover:text-foreground',
                                FOCUS,
                              )}
                            >
                              {sb ? '...' : s.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectSkill(s.slug)}
                              className={cn(
                                'group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[14px] px-3 text-left transition-[background-color] duration-150 hover:bg-[var(--hover)]',
                                FOCUS,
                              )}
                            >
                              {hasSkillGlyph(s.slug) ? (
                                <span
                                  aria-hidden
                                  className={cn(
                                    'inline-flex shrink-0',
                                    s.enabled ? 'text-foreground' : 'text-muted-foreground opacity-70',
                                  )}
                                >
                                  <SkillGlyph slug={s.slug} className="size-4" />
                                </span>
                              ) : (
                                <span
                                  aria-hidden
                                  className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    s.enabled ? 'bg-[var(--foreground)]' : 'bg-[oklch(0.3_0.015_240/0.25)]',
                                  )}
                                />
                              )}
                              <span className="truncate text-[15px]">{displayName(s.slug)}</span>
                              <svg
                                aria-hidden
                                viewBox="0 0 16 16"
                                className="ml-auto size-4 shrink-0 text-muted-foreground transition-[translate] duration-150 group-hover:translate-x-0.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M6 4l4 4-4 4" />
                              </svg>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {/* Community packs */}
      <Section label="Community packs">
        <p className="mb-4 max-w-[78ch] text-[15px] leading-[1.55] text-muted-foreground">
          Maintained by the community in external repos. Press{' '}
          <span className="font-medium text-foreground">Install pack</span> to run the security-scanned installer and
          open a PR, or copy the command to run it yourself. Skills land off; turn them on here after merging.
        </p>
        {community.length ? (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {community.map(pack => {
              const installed = pack.installedCount > 0
              return (
                <li key={pack.repo} className={cn(CARD, 'flex flex-col gap-3 px-5 py-5')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={CARD_TITLE}>
                        <span className="block truncate">{pack.name}</span>
                      </h3>
                      <div className="mt-1 truncate font-mono text-[12px] text-muted-foreground">
                        {pack.author} · {pack.category}
                      </div>
                    </div>
                    <span className={cn(TAG, 'shrink-0', trustTone(pack.trust_level))}>
                      {pack.trust_level || 'community'}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-[15px] leading-[1.5] text-[var(--g-ink-soft)]">{pack.description}</p>
                  <p className="font-mono text-[12px] text-muted-foreground tabular-nums">
                    <CountUp to={pack.skills.length} duration={1.2} /> skill{pack.skills.length === 1 ? '' : 's'}
                    {installed && (
                      <span className="text-foreground">
                        {' '}
                        · <CountUp to={pack.installedCount} duration={1.2} /> installed
                      </span>
                    )}
                  </p>
                  {pack.secrets_required?.length || pack.capabilities?.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Needs">
                      {pack.secrets_required?.map(sec => (
                        <li
                          key={sec}
                          className={cn(
                            TAG,
                            'bg-transparent font-normal normal-case tracking-normal text-foreground shadow-[inset_0_0_0_1px_var(--line)]',
                          )}
                          title="Key this pack needs"
                        >
                          {sec}
                        </li>
                      ))}
                      {pack.capabilities?.map(cap => (
                        <li key={cap} className={cn(TAG, TAG_MUTED, 'font-normal normal-case tracking-normal')}>
                          {cap}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <ActionButton
                      onClick={() => handleInstall(pack)}
                      disabled={installing === pack.repo}
                      title={`Install into your fork - runs the install-skill skill (security-scanned) and opens a PR for review. Skills land off.`}
                      className="flex-1"
                    >
                      {installing === pack.repo ? 'Installing...' : installed ? 'Reinstall' : 'Install pack'}
                    </ActionButton>
                    <IconButton
                      onClick={() => handleCopy(pack)}
                      title={`Copy: bin/install-skill-pack ${installArg(pack)}`}
                      aria-label={copied === pack.repo ? 'Copied the install command' : 'Copy the install command'}
                    >
                      {copied === pack.repo ? (
                        <CheckLightIcon className="size-4" />
                      ) : (
                        <CopyLightIcon className="size-4" />
                      )}
                    </IconButton>
                    {pack.homepage && (
                      <a
                        href={pack.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(ACTION, 'shrink-0 px-3.5')}
                      >
                        Site
                        <ArrowUpRightLightIcon className="size-3.5" />
                        <NewTab />
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className={CARD}>
            <EmptyState title="No community packs yet" hint="The registry has no community packs right now." />
          </div>
        )}
      </Section>
    </div>
  )
}
