'use client'

import { useState } from 'react'
import type { Pack, CommunityPack, Skill } from '../lib/types'
import { displayName } from '../lib/utils'

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
}

function Section({ index, label, children }: { index: string; label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">{index} / {label}</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
      </div>
      {children}
    </section>
  )
}

function trustTone(level?: string): string {
  if (level === 'trusted') return 'text-eva-green border-eva-green/40 bg-eva-green/10'
  if (level === 'community') return 'text-eva-amber border-eva-amber/40 bg-eva-amber/10'
  return 'text-primary-40 border-[rgba(250,250,250,0.18)]'
}

export function PacksPanel({ firstParty, community, skills, enabledPacks, loading, busy, onTogglePack, onToggleSkill, onSelectSkill }: PacksPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Live enabled state comes from the skills roster (single source of truth), so
  // toggling a skill updates the counts here instantly. Hide declared-but-empty
  // packs (e.g. the Lab catch-all when nothing is unsorted).
  const enabledBySlug = new Map(skills.map(s => [s.name, s.enabled]))
  const isPackOn = (key: string) => key === 'core' || enabledPacks.includes(key)
  const visiblePacks = firstParty.filter(p => p.total > 0).map(p => {
    const members = p.skills.map(s => ({ ...s, enabled: enabledBySlug.get(s.slug) ?? false }))
    return { ...p, skills: members, enabled: members.filter(m => m.enabled).length }
  })
  const totalSkills = visiblePacks.reduce((n, p) => n + p.total, 0)
  const onDuty = visiblePacks.reduce((n, p) => n + p.enabled, 0)
  const packsOn = visiblePacks.filter(p => isPackOn(p.key)).length

  const stats = [
    { label: 'Packs', value: visiblePacks.length },
    { label: 'Enabled', value: packsOn, tone: 'text-eva-green' },
    { label: 'Skills', value: totalSkills },
    { label: 'On duty', value: onDuty, tone: 'text-eva-green' },
  ]

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center">
        <p className="font-display uppercase text-aeon-fg text-xl tracking-wide">Loading packs…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
              <span className="w-7 h-px bg-aeon-red" /> Skill packs
            </span>
          </div>
          <h1 className="font-display uppercase leading-[0.92] tracking-tight text-aeon-fg" style={{ fontSize: 'clamp(40px, 6vw, 80px)' }}>
            PACKS
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            Curated bundles of skills. By default you only see <span className="text-aeon-fg">Core</span> - enable a pack to reveal its skills across the sidebar and HQ. Enabling a pack changes what you <span className="text-aeon-fg">see</span>, not what runs; switch individual skills on to put them on duty.
          </p>
        </div>
        <dl className="relative z-10 grid grid-cols-2 sm:grid-cols-4 border-t border-[rgba(250,250,250,0.10)]">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-6 py-5 ${i < stats.length - 1 ? 'border-r border-[rgba(250,250,250,0.10)]' : ''}`}>
              <dt className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary-35 mb-2">{s.label}</dt>
              <dd className={`font-display leading-none ${s.tone || 'text-aeon-fg'}`} style={{ fontSize: 'clamp(28px, 3vw, 44px)' }}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* First-party packs */}
      <Section index="01" label="Your packs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[rgba(250,250,250,0.10)] border border-[rgba(250,250,250,0.10)]">
          {visiblePacks.map(pack => {
            const isCore = pack.key === 'core'
            const on = isPackOn(pack.key)
            const open = expanded === pack.key
            return (
              <div key={pack.key} className="bg-aeon-bg flex flex-col">
                <div className="px-6 py-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: on ? pack.color : 'rgba(250,250,250,0.18)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display uppercase tracking-wide text-aeon-fg text-base leading-tight">{pack.name}</span>
                        {isCore && <span className="text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 border border-aeon-red/40 text-aeon-red">core</span>}
                      </div>
                      <div className="text-[11px] text-primary-40 font-mono mt-1 uppercase tracking-[0.14em]">
                        {pack.total} skill{pack.total === 1 ? '' : 's'}
                        {pack.enabled > 0 && <span className="text-eva-green"> · {pack.enabled} on duty</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-primary-70 leading-relaxed">{pack.description}</p>

                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onTogglePack(pack.key)}
                      disabled={isCore}
                      title={isCore ? 'Core is always shown' : on ? 'Hide this pack’s skills from the dashboard' : 'Reveal this pack’s skills across the sidebar and HQ'}
                      className={`text-[10px] font-mono uppercase tracking-[0.14em] px-3 py-1.5 border transition-colors cursor-target disabled:cursor-default ${on ? 'text-eva-green border-eva-green/50 bg-eva-green/10' : 'text-primary-50 border-[rgba(250,250,250,0.18)] hover:text-primary-100 hover:border-[rgba(250,250,250,0.3)]'}`}
                    >
                      {isCore ? 'Always on' : on ? '✓ Enabled' : 'Enable pack'}
                    </button>
                    <button
                      onClick={() => setExpanded(open ? null : pack.key)}
                      className="text-[10px] font-mono uppercase tracking-[0.14em] px-3 py-1.5 border border-[rgba(250,250,250,0.12)] text-primary-50 hover:text-primary-100 hover:border-[rgba(250,250,250,0.22)] transition-colors cursor-target"
                    >
                      {open ? 'Hide skills' : 'View skills'}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-[rgba(250,250,250,0.08)] divide-y divide-[rgba(250,250,250,0.06)]">
                    {pack.skills.map(s => {
                      const sb = busy[s.slug]
                      return (
                        <div key={s.slug} className="w-full flex items-center gap-2.5 px-6 py-2 hover:bg-aeon-panel transition-colors">
                          <button
                            onClick={() => onToggleSkill(s.slug, !s.enabled)}
                            disabled={sb}
                            title={s.enabled ? 'Disable skill' : 'Enable skill'}
                            className={`text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 border shrink-0 w-9 text-center transition-colors cursor-target disabled:opacity-50 ${s.enabled ? 'text-eva-green border-eva-green/40 hover:bg-eva-green/10' : 'text-primary-40 border-[rgba(250,250,250,0.16)] hover:text-primary-70'}`}
                          >
                            {sb ? '…' : s.enabled ? 'on' : 'off'}
                          </button>
                          <button onClick={() => onSelectSkill(s.slug)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-target">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.enabled ? pack.color : 'rgba(250,250,250,0.18)' }} />
                            <span className="text-xs text-primary-100 truncate">{displayName(s.slug)}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Community packs */}
      <Section index="02" label="Community packs">
        <p className="text-xs text-primary-50 leading-relaxed mb-4">
          Maintained by the community in external repos. Install from a terminal in your fork, then enable the skills here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[rgba(250,250,250,0.10)] border border-[rgba(250,250,250,0.10)]">
          {community.map(pack => {
            const installed = pack.installedCount > 0
            return (
              <div key={pack.repo} className="bg-aeon-bg px-6 py-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display uppercase tracking-wide text-aeon-fg text-sm leading-tight truncate">{pack.name}</div>
                    <div className="text-[10px] text-primary-40 font-mono mt-1 uppercase tracking-[0.14em] truncate">{pack.author} · {pack.category}</div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 border ${trustTone(pack.trust_level)}`}>{pack.trust_level || 'community'}</span>
                </div>
                <p className="text-xs text-primary-70 leading-relaxed line-clamp-3">{pack.description}</p>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">
                  {pack.skills.length} skill{pack.skills.length === 1 ? '' : 's'}
                  {installed && <span className="text-eva-green"> · {pack.installedCount} installed</span>}
                </div>
                {(pack.secrets_required?.length || pack.capabilities?.length) ? (
                  <div className="flex flex-wrap gap-1">
                    {pack.secrets_required?.map(sec => (
                      <span key={sec} className="text-[9px] font-mono px-1.5 py-0.5 border border-eva-amber/30 text-eva-amber">{sec}</span>
                    ))}
                    {pack.capabilities?.map(cap => (
                      <span key={cap} className="text-[9px] font-mono px-1.5 py-0.5 border border-[rgba(250,250,250,0.14)] text-primary-40">{cap}</span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <code className="flex-1 text-[10px] font-mono text-primary-50 bg-aeon-panel px-2 py-1.5 border border-[rgba(250,250,250,0.08)] truncate" title={`./install-skill-pack ${pack.repo}`}>
                    ./install-skill-pack {pack.repo}
                  </code>
                  {pack.homepage && (
                    <a href={pack.homepage} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] font-mono uppercase tracking-[0.14em] text-primary-50 hover:text-eva-orange transition-colors cursor-target">site ↗</a>
                  )}
                </div>
              </div>
            )
          })}
          {!community.length && (
            <div className="bg-aeon-bg px-6 py-12 text-center sm:col-span-2">
              <p className="text-[11px] text-primary-40 font-mono uppercase tracking-[0.18em]">No community packs in the registry</p>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
