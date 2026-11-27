'use client'

import { useState } from 'react'
import type { Skill, Run, Secret, DashboardView } from '../lib/types'
import { packGroups, keyProvidedByHarness } from '../lib/constants'
import { displayName, initials, getSkillStatus } from '../lib/utils'
import { SkillGlyph, hasSkillGlyph } from './ui/SkillGlyph'
import { cn } from '@/lib/cn'
import { ACTION, CHIP, CHIP_OFF, CHIP_ON, FOCUS, IconButton, SearchIcon, SMALL_LABEL } from './glass/connect/ui'

type View = DashboardView

interface LeftSidebarProps {
  view: View
  setView: (v: View) => void
  selectedSkill: string | null
  skills: Skill[]
  runs: Run[]
  secrets: Secret[]
  repo: string
  harness: string
  enabledCount: number
  workingCount: number
  categoryFilter: string | null
  setCategoryFilter: (c: string | null) => void
  onSkillSelect: (name: string) => void
  onShowImport: () => void
  // Phones: the sidebar is a drawer, closed from its own header.
  onClose?: () => void
  className?: string
}

// Icons: Heroicons outline paths (MIT), drawn at 1.5px like the website's light set.
const NAV: { id: View; label: string; icon: string }[] = [
  {
    id: 'hq',
    label: 'HQ',
    icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z',
  },
  {
    id: 'packs',
    label: 'Packs',
    icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5',
  },
  {
    id: 'soul',
    label: 'Soul',
    icon: 'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    id: 'mcp',
    label: 'MCP',
    icon: 'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z',
  },
  {
    id: 'secrets',
    label: 'Keys',
    icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
  },
]

// Compact buttons, two per row: a soft pill each, the current view raised as a glass chip.
const LINK = cn(
  'flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-left text-[14px] transition-[background-color,color,box-shadow] duration-150 [&_svg]:size-4 [&_svg]:shrink-0',
  FOCUS,
)
const LINK_ON = 'g-chip font-medium text-foreground [&_svg]:text-[var(--primary)]'
const LINK_OFF =
  'bg-[oklch(1_0_0/0.4)] text-[var(--g-ink-soft)] shadow-[inset_0_0_0_1px_oklch(0.3_0.015_240/0.08)] hover:bg-[var(--hover)] hover:text-foreground [&_svg]:text-muted-foreground'

function Icon({ d }: { d: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

// A skill's state as a mark plus a word: orange when it needs you (an error) or is working now.
function SkillState({ label, color }: { label: string; color: string }) {
  const attention = color === 'red' || color === 'orange'
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 font-mono text-[11px] tracking-[0.04em]',
        color === 'red' ? 'text-[oklch(0.5_0.19_33)]' : 'text-muted-foreground',
      )}
    >
      {color === 'red' ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-3 shrink-0" fill="currentColor">
          <circle cx="8" cy="8" r="7" />
          <path
            d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
            stroke="oklch(0.985 0.004 220)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            attention
              ? 'animate-pulse bg-[var(--primary)]'
              : color === 'green'
                ? 'bg-[var(--g-ink-soft)]'
                : 'shadow-[inset_0_0_0_1.5px_oklch(0.3_0.015_240/0.4)]',
          )}
        />
      )}
      {color === 'red' ? 'Failed last run' : label}
    </span>
  )
}

/** The dashboard menu, as the website's docs sidebar: a glass column that stays in view on wide
 *  screens (a drawer on phones). Views first, then the skills roster with search and pack chips. */
export function LeftSidebar({
  selectedSkill,
  skills,
  runs,
  secrets,
  harness,
  categoryFilter,
  setCategoryFilter,
  onSkillSelect,
  onShowImport,
  onClose,
  className,
}: LeftSidebarProps) {
  const [skillSearch, setSkillSearch] = useState('')
  const visibleGroups = packGroups(skills)
  // The roster only ever holds skills from *enabled packs* (Core by default -
  // the parent filters before passing `skills`), so it's already focused. We
  // show all of those skills (enabled or not); "Enabled" is an opt-in filter,
  // off by default, to narrow to what's actually on duty.
  const [enabledOnly, setEnabledOnly] = useState(false)

  // A skill is "key-blocked" when it's enabled but a required (non-optional)
  // credential it declares isn't set AND isn't provided natively by the active
  // harness (Grok Build covers XAI_API_KEY) - flagged inline so the operator sees
  // it without opening each skill.
  const setSecretNames = new Set(secrets.filter(s => s.isSet).map(s => s.name))
  const missingRequiredKeys = (s: Skill) =>
    (s.requires ?? []).filter(r => !r.optional && !setSecretNames.has(r.key) && !keyProvidedByHarness(r.key, harness))

  // `categoryFilter` holds a PACK key - the sidebar groups by pack. Picking a
  // pack reveals ALL its skills (enabled + disabled) so you can switch them on in
  // context; with no pack selected the roster stays focused on enabled skills.
  // The chips are one choice: All, Enabled, or one pack (a pack already shows
  // its enabled and disabled skills together).
  const effectiveEnabledOnly = enabledOnly && !categoryFilter
  const allOn = categoryFilter === null && !enabledOnly
  const query = skillSearch.trim()
  const matchesFilters = (s: Skill) => {
    if (categoryFilter && (s.pack || 'lab') !== categoryFilter) return false
    if (
      skillSearch &&
      !(
        displayName(s.name).toLowerCase().includes(skillSearch.toLowerCase()) ||
        s.name.includes(skillSearch.toLowerCase())
      )
    )
      return false
    if (effectiveEnabledOnly && !s.enabled) return false
    return true
  }
  const visibleCount = skills.filter(matchesFilters).length

  return (
    <div className={cn('g-glass flex w-full flex-col rounded-[24px]', className)}>
      {/* Phones: the drawer closes from its own corner. The views live in the main panel's bar. */}
      {onClose && (
        <div className="relative z-[1] flex justify-end px-3 pt-3">
          <IconButton onClick={onClose} aria-label="Close navigation">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </IconButton>
        </div>
      )}

      {/* Team roster: the header, search and chips stay put while the list scrolls under them. */}
      <div className="relative z-[1] shrink-0 px-2 pb-2">
        <div className="mt-4 flex items-center justify-between px-3">
          <h2 className={SMALL_LABEL}>Skills</h2>
          <button
            type="button"
            onClick={onShowImport}
            className={cn(
              '-mr-1 flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 font-mono text-[11.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase transition-[background-color,color] duration-150 hover:bg-[var(--hover)] hover:text-foreground',
              FOCUS,
            )}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add
          </button>
        </div>
        <div className="mt-2 px-1">
          <label className="g-chip flex h-11 items-center gap-2.5 rounded-full px-4 focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--foreground)]">
            <span className="sr-only">Search skills</span>
            <span aria-hidden className="text-muted-foreground [&_svg]:size-4">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && skillSearch) {
                  e.stopPropagation()
                  setSkillSearch('')
                }
              }}
              placeholder="Search skills"
              className="c-field-input h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
            />
            {skillSearch && (
              <button
                type="button"
                onClick={() => setSkillSearch('')}
                aria-label="Clear search"
                className={cn(
                  '-mr-2 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-[background-color,color] duration-150 hover:bg-[var(--hover)] hover:text-foreground',
                  FOCUS,
                )}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                >
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                </svg>
              </button>
            )}
          </label>
        </div>

        {/* Pack filter */}
        <div className="mt-3 flex flex-wrap gap-1.5 px-1">
          <button
            type="button"
            aria-pressed={allOn}
            onClick={() => {
              setCategoryFilter(null)
              setEnabledOnly(false)
            }}
            className={cn(CHIP, 'h-9 px-3 text-[11px]', allOn ? CHIP_ON : CHIP_OFF)}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={effectiveEnabledOnly}
            onClick={() => {
              setCategoryFilter(null)
              setEnabledOnly(!effectiveEnabledOnly)
            }}
            title="Show only enabled skills"
            className={cn(CHIP, 'h-9 px-3 text-[11px]', effectiveEnabledOnly ? CHIP_ON : CHIP_OFF)}
          >
            Enabled
          </button>
          {visibleGroups.map(cat => {
            const active = categoryFilter === cat.key
            return (
              <button
                type="button"
                key={cat.key}
                aria-pressed={active}
                onClick={() => {
                  setEnabledOnly(false)
                  setCategoryFilter(active ? null : cat.key)
                }}
                title={`${cat.label} - show this pack's skills`}
                className={cn(CHIP, 'h-9 px-3 text-[11px]', active ? CHIP_ON : CHIP_OFF)}
              >
                {cat.short}
              </button>
            )
          })}
        </div>
      </div>

      <div className="c-scroll relative z-[1] min-h-0 flex-1 overflow-y-auto px-2 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_14px)]">
        {visibleGroups.map(cat => {
          if (categoryFilter && cat.key !== categoryFilter) return null
          const catSkills = skills.filter(s => (s.pack || 'lab') === cat.key)
          if (!catSkills.length) return null
          const searched = skillSearch
            ? catSkills.filter(
                s =>
                  displayName(s.name).toLowerCase().includes(skillSearch.toLowerCase()) ||
                  s.name.includes(skillSearch.toLowerCase()),
              )
            : catSkills
          const filtered = effectiveEnabledOnly ? searched.filter(s => s.enabled) : searched
          if (!filtered.length) return null
          const en = filtered.filter(s => s.enabled).length
          return (
            <div key={cat.key} className="mt-3 first:mt-2">
              <div className="flex items-center justify-between px-3">
                <h3 className={SMALL_LABEL}>{cat.label}</h3>
                <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums" title={`${en} enabled`}>
                  {en} enabled
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {filtered
                  .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
                  .map(s => {
                    const st = getSkillStatus(s.name, s.enabled, runs)
                    const sel = selectedSkill === s.name
                    const keyGap = s.enabled && missingRequiredKeys(s).length > 0
                    return (
                      <li key={s.name}>
                        <button
                          type="button"
                          onClick={() => onSkillSelect(s.name)}
                          aria-current={sel ? 'page' : undefined}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2.5 rounded-[16px] px-2 py-1.5 text-left transition-[background-color] duration-150',
                            sel ? 'g-chip' : 'hover:bg-[var(--hover)]',
                            FOCUS,
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'grid size-8 shrink-0 place-items-center rounded-full',
                              s.enabled
                                ? 'bg-[oklch(0.3_0.015_240/0.09)] text-foreground'
                                : 'text-muted-foreground shadow-[inset_0_0_0_1px_oklch(0.3_0.015_240/0.16)]',
                            )}
                          >
                            {hasSkillGlyph(s.name) ? (
                              <SkillGlyph slug={s.name} className="size-4" />
                            ) : (
                              <span className="font-mono text-[10px] font-semibold">{initials(s.name)}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-[14px] leading-[1.35]', sel && 'font-medium')}>
                              {displayName(s.name)}
                            </span>
                            <SkillState label={st.label} color={st.color} />
                          </span>
                          {keyGap && (
                            <span
                              title="Enabled, but a required API key is missing"
                              className="shrink-0 text-[oklch(0.55_0.2_33)]"
                            >
                              <svg
                                className="size-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.8}
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                                />
                              </svg>
                              <span className="sr-only">Missing required API key</span>
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          )
        })}

        {visibleCount === 0 && (
          <div className="px-4 py-10 text-center">
            {/* Name the filter that hides everything: the search first, as it narrows the most. */}
            <p className={cn(SMALL_LABEL, '[overflow-wrap:anywhere]')}>
              {query
                ? `No skills match "${query}"`
                : effectiveEnabledOnly
                  ? 'No skills enabled'
                  : 'No skills in this pack'}
            </p>
            {query ? (
              <button type="button" onClick={() => setSkillSearch('')} className={cn(ACTION, 'mt-3')}>
                Clear search
              </button>
            ) : (
              (effectiveEnabledOnly || categoryFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setEnabledOnly(false)
                    setCategoryFilter(null)
                  }}
                  className={cn(ACTION, 'mt-3')}
                >
                  Show all skills
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The dashboard's views (HQ, Packs, Strategy, Soul, MCP, Keys) as compact pills in the main
 *  panel's bar. */
export function ViewNav({
  view,
  selectedSkill,
  setView,
}: {
  view: View
  selectedSkill: string | null
  setView: (v: View) => void
}) {
  return (
    <nav aria-label="Dashboard">
      <ul className="flex flex-wrap gap-1.5">
        {NAV.map(item => {
          const on = view === item.id && !selectedSkill
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setView(item.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(LINK, 'w-auto', on ? LINK_ON : LINK_OFF)}
              >
                <Icon d={item.icon} />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
