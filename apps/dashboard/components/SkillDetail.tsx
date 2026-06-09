'use client'

import { useState } from 'react'
import type { Skill, Run, Secret, SkillMcpRef } from '../lib/types'
import { MODELS, CATEGORY_BY_KEY } from '../lib/constants'
import { MCP_BY_SLUG } from '../lib/mcp-catalog'
import { displayName, getSkillStatus, cronLabel, statusDot, inputCls } from '../lib/utils'
import { ScheduleEditor } from './ScheduleEditor'
import { timeAgo } from '../lib/utils'
import { Scramble } from './ui/Animated'

interface SkillDetailProps {
  skill: Skill
  runs: Run[]
  model: string
  secrets: Secret[]
  mcpServers: Record<string, Record<string, unknown>>
  busy: Record<string, boolean>
  onToggle: (name: string, enabled: boolean) => void
  onRun: (name: string, v?: string, m?: string) => void
  onDelete: (name: string) => void
  onUpdateSchedule: (name: string, schedule: string) => void
  onUpdateVar: (name: string, v: string) => void
  onUpdateModel: (name: string, m: string) => void
  onGoToSecret: (name: string) => void
  onGoToMcp: () => void
  onViewRun: (run: Run) => void
}

function Section({ index, label, action, children }: { index: string; label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">{index} / {label}</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        {action}
      </div>
      {children}
    </section>
  )
}

// A single declared credential. The key name and the right-hand action both
// jump to Settings → Access Keys, scrolled to this key with its input open —
// so the operator can paste the value in one click.
function KeyRow({ kref, secret, onGoTo }: { kref: { key: string; optional: boolean }; secret?: Secret; onGoTo: (name: string) => void }) {
  const isSet = !!secret?.isSet
  const desc = secret?.description || 'Third-party credential referenced by this skill.'

  // Status color: set → green. Missing required → red. Missing "works better" → muted amber.
  const dot = isSet ? 'bg-eva-green' : kref.optional ? 'bg-eva-orange/60' : 'bg-eva-red'
  const tierLabel = kref.optional ? 'Works better' : 'Required'
  const tierColor = kref.optional ? 'text-eva-orange/80' : 'text-aeon-red'

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <button onClick={() => onGoTo(kref.key)} title="Open in Settings to set this key" className="font-mono text-xs text-aeon-fg hover:text-eva-orange underline decoration-dotted underline-offset-2 transition-colors">{kref.key}</button>
            <span className={`text-[9px] font-mono uppercase tracking-[0.18em] ${tierColor}`}>{tierLabel}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary-35">{isSet ? '· set' : '· not set'}</span>
          </div>
          <div className="text-[11px] text-primary-40 font-mono mt-0.5 leading-relaxed">{desc}</div>
        </div>
        <button
          onClick={() => onGoTo(kref.key)}
          className={`text-[11px] font-mono px-2 py-1 shrink-0 uppercase tracking-[0.14em] transition-colors ${isSet ? 'text-eva-green hover:text-aeon-fg' : 'text-primary-40 hover:text-eva-orange'}`}
        >
          {isSet ? '✓ in vault' : 'Set →'}
        </button>
      </div>
    </div>
  )
}

// A single declared MCP server. Mirrors KeyRow: logo + name + install/installed
// status, with the action jumping to the MCP page to install it.
function McpRow({ mref, installed, onGoTo }: { mref: SkillMcpRef; installed: boolean; onGoTo: () => void }) {
  const entry = MCP_BY_SLUG[mref.slug]
  const name = entry?.name || mref.slug
  const url = entry?.url || ''
  const desc = entry?.description || 'MCP server this skill calls during a run.'
  const dot = installed ? 'bg-eva-green' : mref.optional ? 'bg-eva-orange/60' : 'bg-eva-red'
  const tierLabel = mref.optional ? 'Works better' : 'Required'
  const tierColor = mref.optional ? 'text-eva-orange/80' : 'text-aeon-red'

  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {entry?.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={entry.logo} alt={name} width={32} height={32} className="w-8 h-8 rounded object-cover bg-aeon-bg shrink-0 border border-[rgba(250,250,250,0.10)] mt-0.5" />
            : <span className={`w-2 h-2 rounded-full shrink-0 mt-2 ${dot}`} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={onGoTo} title="Manage on the MCP page" className="font-mono text-xs text-aeon-fg hover:text-eva-orange underline decoration-dotted underline-offset-2 transition-colors">{name}</button>
              <span className={`text-[9px] font-mono uppercase tracking-[0.18em] ${tierColor}`}>{tierLabel}</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary-35">{installed ? '· installed' : '· not installed'}</span>
            </div>
            {url && <div className="text-[11px] text-primary-50 font-mono mt-0.5 truncate">{url}</div>}
            <div className="text-[11px] text-primary-40 font-mono mt-0.5 leading-relaxed">{desc}</div>
          </div>
        </div>
        <button
          onClick={onGoTo}
          className={`text-[11px] font-mono px-2 py-1 shrink-0 uppercase tracking-[0.14em] transition-colors ${installed ? 'text-eva-green hover:text-aeon-fg' : 'text-primary-40 hover:text-eva-orange'}`}
        >
          {installed ? '✓ installed' : 'Install →'}
        </button>
      </div>
    </div>
  )
}

export function SkillDetail({ skill, runs, model, secrets, mcpServers, busy, onToggle, onRun, onDelete, onUpdateSchedule, onUpdateVar, onUpdateModel, onGoToSecret, onGoToMcp, onViewRun }: SkillDetailProps) {
  const modelOptions = MODELS
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editingVar, setEditingVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')

  const cat = CATEGORY_BY_KEY[skill.category || 'meta'] || null
  const skillRuns = runs.filter(r => r.workflow.toLowerCase().includes(skill.name))
  const st = getSkillStatus(skill.name, skill.enabled, runs)

  // Join the skill's declared `requires` against the central credential registry
  // (the same list shown in Settings → Access Keys) for descriptions + set state.
  const secretByName = new Map(secrets.map(s => [s.name, s]))
  const requires = skill.requires ?? []
  const requiredKeys = requires.filter(r => !r.optional)
  const worksBetterKeys = requires.filter(r => r.optional)
  const missingRequired = requiredKeys.filter(r => !secretByName.get(r.key)?.isSet)

  // Join the skill's declared `mcp:` servers against the live .mcp.json config
  // (installed = its URL is present) and the MCP catalog for name/logo/url.
  const installedMcpUrls = new Set(Object.values(mcpServers ?? {}).map(s => s?.url).filter(Boolean) as string[])
  const isMcpInstalled = (slug: string) => { const u = MCP_BY_SLUG[slug]?.url; return !!u && installedMcpUrls.has(u) }
  const mcp = skill.mcp ?? []
  const requiredMcp = mcp.filter(m => !m.optional)
  const worksBetterMcp = mcp.filter(m => m.optional)
  const missingRequiredMcp = requiredMcp.filter(m => !isMcpInstalled(m.slug))

  // Section numbers are assigned in render order; the API keys and MCP sections
  // only appear when the skill declares requirements, so number them dynamically.
  let sectionN = 0
  const nextN = () => String(++sectionN).padStart(2, '0')
  const nApiKeys = requires.length > 0 ? nextN() : ''
  const nMcp = mcp.length > 0 ? nextN() : ''
  const nSchedule = nextN()
  const nBrief = nextN()
  const nCapability = nextN()
  const nActivity = nextN()

  // Scramble locks each word to `white-space: nowrap`, so a long unbreakable
  // token (e.g. "INVESTIGATION", 13 chars) can't wrap and would overflow the
  // hero box. Scale the max font-size down by the longest word so it always fits.
  const title = displayName(skill.name)
  const longestWord = title.split(' ').reduce((m, w) => Math.max(m, w.length), 0)
  const titleMaxPx = longestWord >= 13 ? 50 : longestWord >= 11 ? 60 : longestWord >= 9 ? 72 : 88

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-10">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
              <span className="w-7 h-px bg-aeon-red" />
              {cat ? cat.label : 'Skill'}
            </span>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary-50">
              <span className={statusDot(st.color)} />
              {st.label}
            </span>
          </div>
          <h1 className="font-display uppercase leading-[0.92] tracking-tight text-aeon-fg break-words"
              style={{ fontSize: `clamp(32px, 6vw, ${titleMaxPx}px)` }}>
            <Scramble key={skill.name} text={title} />
          </h1>
          {skill.description && (
            <p className="mt-4 max-w-2xl text-sm text-primary-70 leading-relaxed">{skill.description}</p>
          )}

          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onToggle(skill.name, !skill.enabled)}
              disabled={!!busy[skill.name]}
              className={skill.enabled ? 'btn-ghost' : 'btn-solid'}
            >
              {skill.enabled ? 'Off Duty' : 'On Duty'}
            </button>
            <button
              onClick={() => onRun(skill.name, skill.var, skill.model)}
              disabled={!!busy[`r-${skill.name}`]}
              className="btn-solid disabled:opacity-50"
              style={{ background: 'var(--aeon-red)', borderColor: 'var(--aeon-red)', color: 'var(--aeon-fg-pure)' }}
            >
              {busy[`r-${skill.name}`] ? '…' : 'Run now'}
            </button>
            <button
              onClick={() => { if (confirm(`Remove ${displayName(skill.name)}?`)) onDelete(skill.name) }}
              className="text-[11px] text-eva-red/50 hover:text-eva-red font-mono px-3 py-2 ml-auto transition-colors uppercase tracking-[0.18em]"
            >
              Remove
            </button>
          </div>
        </div>
      </section>

      {requires.length > 0 && (
        <Section index={nApiKeys} label="API keys">
          {missingRequired.length > 0 && (
            <div className="mb-4 flex items-start gap-3 border border-eva-red/40 bg-eva-red/5 px-4 py-3">
              <span className="text-eva-red text-sm leading-none mt-0.5">▲</span>
              <p className="text-[12px] text-primary-70 font-mono leading-relaxed">
                Missing {missingRequired.length} required key{missingRequired.length > 1 ? 's' : ''} —
                this skill won&apos;t work until {missingRequired.length > 1 ? 'they are' : 'it is'} set:{' '}
                {missingRequired.map((r, i) => (
                  <span key={r.key}>
                    {i > 0 && ', '}
                    <button onClick={() => onGoToSecret(r.key)} title="Open in Settings to set this key" className="text-eva-red underline decoration-dotted underline-offset-2 hover:text-aeon-fg transition-colors">{r.key}</button>
                  </span>
                ))}
              </p>
            </div>
          )}
          {requiredKeys.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-aeon-red mb-2">Required to run</div>
              <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
                {requiredKeys.map(r => (
                  <KeyRow key={r.key} kref={r} secret={secretByName.get(r.key)} onGoTo={onGoToSecret} />
                ))}
              </div>
            </div>
          )}
          {worksBetterKeys.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-orange/80 mb-2">Works better with</div>
              <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
                {worksBetterKeys.map(r => (
                  <KeyRow key={r.key} kref={r} secret={secretByName.get(r.key)} onGoTo={onGoToSecret} />
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {mcp.length > 0 && (
        <Section index={nMcp} label="MCP servers">
          {missingRequiredMcp.length > 0 && (
            <div className="mb-4 flex items-start gap-3 border border-eva-red/40 bg-eva-red/5 px-4 py-3">
              <span className="text-eva-red text-sm leading-none mt-0.5">▲</span>
              <p className="text-[12px] text-primary-70 font-mono leading-relaxed">
                Missing {missingRequiredMcp.length} required MCP server{missingRequiredMcp.length > 1 ? 's' : ''} —
                this skill won&apos;t work until {missingRequiredMcp.length > 1 ? 'they are' : 'it is'} installed from the{' '}
                <button onClick={onGoToMcp} className="text-eva-red underline decoration-dotted underline-offset-2 hover:text-aeon-fg transition-colors">MCP page</button>:{' '}
                <span className="text-eva-red">{missingRequiredMcp.map(m => MCP_BY_SLUG[m.slug]?.name || m.slug).join(', ')}</span>
              </p>
            </div>
          )}
          {requiredMcp.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-aeon-red mb-2">Required to run</div>
              <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
                {requiredMcp.map(m => (
                  <McpRow key={m.slug} mref={m} installed={isMcpInstalled(m.slug)} onGoTo={onGoToMcp} />
                ))}
              </div>
            </div>
          )}
          {worksBetterMcp.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-orange/80 mb-2">Works better with</div>
              <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
                {worksBetterMcp.map(m => (
                  <McpRow key={m.slug} mref={m} installed={isMcpInstalled(m.slug)} onGoTo={onGoToMcp} />
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      <Section
        index={nSchedule}
        label="Shift schedule"
        action={
          <button
            onClick={() => setEditingSchedule(!editingSchedule)}
            className="text-[11px] text-primary-40 font-mono uppercase tracking-[0.18em] hover:text-aeon-red transition-colors"
          >
            {editingSchedule ? 'Cancel' : 'Edit'}
          </button>
        }
      >
        {editingSchedule ? (
          <div className="border border-[rgba(250,250,250,0.10)] p-5 bg-aeon-panel">
            <ScheduleEditor cron={skill.schedule} onSave={(c) => { onUpdateSchedule(skill.name, c); setEditingSchedule(false) }} />
          </div>
        ) : (
          <div className="font-display uppercase tracking-tight text-aeon-fg" style={{ fontSize: 'clamp(24px, 3vw, 36px)' }}>
            {cronLabel(skill.schedule)}
          </div>
        )}
      </Section>

      <Section
        index={nBrief}
        label="Assignment brief"
        action={
          <button
            onClick={() => { setEditingVar(!editingVar); setVarDraft(skill.var) }}
            className="text-[11px] text-primary-40 font-mono uppercase tracking-[0.18em] hover:text-aeon-red transition-colors"
          >
            {editingVar ? 'Cancel' : 'Edit'}
          </button>
        }
      >
        {editingVar ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={varDraft}
              onChange={(e) => setVarDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateVar(skill.name, varDraft); setEditingVar(false) } }}
              placeholder="e.g. AI, bitcoin, owner/repo"
              className={inputCls}
            />
            <button onClick={() => { onUpdateVar(skill.name, varDraft); setEditingVar(false) }} className="btn-solid">Save</button>
          </div>
        ) : skill.var ? (
          <div className="font-display uppercase tracking-tight text-aeon-fg" style={{ fontSize: 'clamp(22px, 2.4vw, 30px)' }}>
            &ldquo;{skill.var}&rdquo;
          </div>
        ) : (
          <div className="text-sm text-primary-35 font-mono uppercase tracking-[0.18em]">No assignment — falls back to defaults</div>
        )}
      </Section>

      <Section index={nCapability} label="Capability level">
        <select
          value={skill.model}
          onChange={(e) => onUpdateModel(skill.name, e.target.value)}
          className="bg-aeon-panel text-aeon-fg text-sm px-4 py-3 border border-[rgba(250,250,250,0.10)] outline-none font-mono w-full max-w-md cursor-pointer hover:border-[rgba(250,250,250,0.22)] focus:border-aeon-red transition-colors"
        >
          <option value="">Default ({modelOptions.find(m => m.id === model)?.label ?? model})</option>
          {modelOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Section>

      <Section index={nActivity} label="Activity log">
        <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
          {skillRuns.slice(0, 10).map(run => (
            <button
              key={run.id}
              onClick={() => onViewRun(run)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-aeon-panel transition-colors text-left group"
            >
              <span className={`text-sm w-4 shrink-0 ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                {run.conclusion === 'success' ? '✓' : run.conclusion === 'failure' ? '✗' : run.status === 'in_progress' ? '◌' : '·'}
              </span>
              <span className="text-xs text-primary-70 truncate flex-1 font-mono group-hover:text-aeon-fg transition-colors">
                {run.conclusion === 'success' ? 'Task completed' : run.conclusion === 'failure' ? 'Task failed' : run.status === 'in_progress' ? 'Working…' : 'Queued'}
              </span>
              <span className="text-[10px] text-primary-35 font-mono tabular-nums uppercase tracking-[0.14em]">{timeAgo(run.created_at)}</span>
            </button>
          ))}
          {!skillRuns.length && (
            <div className="px-6 py-12 text-center">
              <p className="font-display uppercase text-aeon-fg text-xl tracking-wide">No activity</p>
              <p className="text-[11px] text-primary-40 font-mono mt-2 uppercase tracking-[0.18em]">This skill hasn&apos;t fired yet</p>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
